import { withTransaction, query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  transfersRepository,
  TransferWithDetails,
  ListTransfersOptions,
} from "./transfers.repository";
import { notificationService } from "../notifications/notification.service";

export interface InitiateTransferInput {
  assetId: string;
  fromCompanyId?: string;
  toCompanyId?: string;
  fromEmployeeId?: string | null;
  toEmployeeId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  transferType: "EMPLOYEE_TO_EMPLOYEE" | "DEPT_TO_DEPT" | "LOCATION_TO_LOCATION" | "INTER_COMPANY";
  reason: string;
  conditionBefore?: string;
  expectedDeliveryDate?: string | null;
  transferFee?: number;
  remarks?: string | null;
}

export interface ConfirmReceiptInput {
  conditionAfter?: string;
  destinationBranchId?: string | null;
  destinationDepartmentId?: string | null;
  destinationLocationId?: string | null;
  destinationEmployeeId?: string | null;
  acknowledgementNotes?: string | null;
  receiverId?: string | null;
  signatureToken?: string | null;
}

export class TransfersService {
  async initiateTransfer(input: InitiateTransferInput, user: AuthUser): Promise<TransferWithDetails> {
    if (!input.assetId) {
      throw new ValidationError("Asset ID is required to initiate a transfer");
    }
    if (!input.transferType) {
      throw new ValidationError("Transfer type is required");
    }
    if (!input.reason || !input.reason.trim()) {
      throw new ValidationError("Business justification / transfer reason is required");
    }

    return await withTransaction(async (client) => {
      // 1. Lock the asset row to prevent race conditions
      const assetRes = await client.query(`
        SELECT id, company_id, branch_id, department_id, location_id, assigned_employee_id, status, condition, current_value, asset_tag, name
        FROM assets
        WHERE id = $1
        FOR UPDATE;
      `, [input.assetId]);

      if (assetRes.rows.length === 0) {
        throw new NotFoundError(`Asset '${input.assetId}' not found`);
      }
      const asset = assetRes.rows[0];

      // 2. Tenancy enforcement on sender
      assertCompanyAccess(user, asset.company_id);

      // 3. Status Check: Must be in a transferable state
      const invalidStatuses = ["UNDER_MAINTENANCE", "DAMAGED", "LOST", "IN_TRANSIT", "DISPUTED", "RETIRED", "DISPOSED"];
      if (invalidStatuses.includes(asset.status)) {
        throw new ConflictError(
          `Asset '${asset.asset_tag}' cannot be transferred because its current status is '${asset.status}'`
        );
      }

      // 4. Verify no pending transfer already exists for this asset
      const pendingTransfers = await client.query(`
        SELECT id, transfer_code, status 
        FROM asset_transfers 
        WHERE asset_id = $1 AND status IN ('INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING');
      `, [asset.id]);

      if (pendingTransfers.rows.length > 0) {
        throw new ConflictError(
          `Asset '${asset.asset_tag}' is already part of an active transfer (${pendingTransfers.rows[0].transfer_code}) in status '${pendingTransfers.rows[0].status}'`
        );
      }

      const fromCompanyId = asset.company_id;
      let toCompanyId = input.toCompanyId || fromCompanyId;

      // 5. Transfer Type Validations
      switch (input.transferType) {
        case "EMPLOYEE_TO_EMPLOYEE": {
          toCompanyId = fromCompanyId;
          if (!input.toEmployeeId) {
            throw new ValidationError("Destination employee ID is required for employee-to-employee transfer");
          }
          if (asset.assigned_employee_id && asset.assigned_employee_id === input.toEmployeeId) {
            throw new BadRequestError("Destination employee is already the current custodian of this asset");
          }
          // Verify destination employee belongs to same company
          const toEmpRes = await client.query(`SELECT id, company_id, status FROM employees WHERE id = $1;`, [input.toEmployeeId]);
          if (toEmpRes.rows.length === 0 || toEmpRes.rows[0].status !== "ACTIVE") {
            throw new NotFoundError(`Destination employee '${input.toEmployeeId}' not found or inactive`);
          }
          if (toEmpRes.rows[0].company_id !== fromCompanyId) {
            throw new BadRequestError("Internal transfer violation: Destination employee belongs to a different company");
          }
          break;
        }

        case "DEPT_TO_DEPT": {
          toCompanyId = fromCompanyId;
          if (!input.toDepartmentId) {
            throw new ValidationError("Destination department ID is required for department transfer");
          }
          const toDeptRes = await client.query(`SELECT id, company_id FROM departments WHERE id = $1;`, [input.toDepartmentId]);
          if (toDeptRes.rows.length === 0) {
            throw new NotFoundError(`Destination department '${input.toDepartmentId}' not found`);
          }
          if (toDeptRes.rows[0].company_id !== fromCompanyId) {
            throw new BadRequestError("Internal transfer violation: Destination department belongs to a different company");
          }
          break;
        }

        case "LOCATION_TO_LOCATION": {
          toCompanyId = fromCompanyId;
          if (!input.toLocationId) {
            throw new ValidationError("Destination location ID is required for location transfer");
          }
          const toLocRes = await client.query(`SELECT id, company_id FROM locations WHERE id = $1;`, [input.toLocationId]);
          if (toLocRes.rows.length === 0) {
            throw new NotFoundError(`Destination location '${input.toLocationId}' not found`);
          }
          if (toLocRes.rows[0].company_id !== fromCompanyId) {
            throw new BadRequestError("Internal transfer violation: Destination location belongs to a different company");
          }
          break;
        }

        case "INTER_COMPANY": {
          if (!input.toCompanyId) {
            throw new ValidationError("Destination company ID is required for inter-company transfer");
          }
          if (input.toCompanyId === fromCompanyId) {
            throw new BadRequestError("Inter-company transfer destination must be a different company");
          }
          // Only Company Admin or Asset Manager can initiate inter-company transfer
          if (!user.isCommonAdmin && user.roleCode !== "COMPANY_ADMIN" && user.roleCode !== "ASSET_MANAGER") {
            throw new ForbiddenError("Only Company Administrators or Asset Managers can initiate inter-company transfers");
          }
          // Verify target company exists and is active
          const toCompRes = await client.query(`SELECT id, is_active FROM companies WHERE id = $1;`, [input.toCompanyId]);
          if (toCompRes.rows.length === 0 || !toCompRes.rows[0].is_active) {
            throw new NotFoundError(`Destination company '${input.toCompanyId}' not found or inactive`);
          }
          toCompanyId = input.toCompanyId;
          break;
        }

        default:
          throw new ValidationError(`Unsupported transfer type '${input.transferType}'`);
      }

      // 6. Create Transfer Record
      const transfer = await transfersRepository.create({
        assetId: asset.id,
        fromCompanyId,
        toCompanyId,
        fromEmployeeId: asset.assigned_employee_id || input.fromEmployeeId || null,
        toEmployeeId: input.toEmployeeId || null,
        fromDepartmentId: asset.department_id || input.fromDepartmentId || null,
        toDepartmentId: input.toDepartmentId || null,
        fromLocationId: asset.location_id || input.fromLocationId || null,
        toLocationId: input.toLocationId || null,
        transferType: input.transferType,
        requestedBy: user.id,
        conditionBefore: input.conditionBefore || asset.condition || "GOOD",
        reason: input.reason.trim(),
        expectedDeliveryDate: input.expectedDeliveryDate || null,
        remarks: input.remarks || null,
      }, client);

      // 7. If Inter-Company, create inter-company protocol row
      if (input.transferType === "INTER_COMPANY") {
        await transfersRepository.createInterCompany({
          transferId: transfer.id,
          fromCompanyId,
          toCompanyId,
          sendingAdminId: user.id,
          originatingBookValue: Number(asset.current_value) || 0.00,
          transferFee: input.transferFee !== undefined ? Number(input.transferFee) : 0.00,
        }, client);
      }

      // 8. Add Asset History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'TRANSFER_INITIATED', $3, $3, 'asset_transfers', $4, $5::jsonb);
      `, [
        asset.id,
        fromCompanyId,
        asset.status,
        user.id,
        JSON.stringify({
          transferCode: transfer.transfer_code,
          transferType: input.transferType,
          toCompanyId,
          toEmployeeId: input.toEmployeeId,
          reason: input.reason
        })
      ]);

      // 9. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'TRANSFER_INITIATED', 'asset_transfers', $3, $4::jsonb);
      `, [
        fromCompanyId,
        user.id,
        transfer.id,
        JSON.stringify({
          transferCode: transfer.transfer_code,
          assetTag: asset.asset_tag,
          transferType: input.transferType,
          fromCompanyId,
          toCompanyId
        })
      ]);

      // 10. Notifications
      if (input.transferType === "INTER_COMPANY") {
        await notificationService.notifyCompanyAdmins(fromCompanyId, {
          notificationType: "INTERCOMPANY_TRANSFER_CREATED",
          title: `Inter-Company Transfer Initiated: ${transfer.transfer_code}`,
          message: `Inter-company transfer for '${asset.name}' (${asset.asset_tag}) has been initiated.`,
          severity: "INFO",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);

        if (toCompanyId) {
          await notificationService.notifyCompanyAdmins(toCompanyId, {
            notificationType: "INTERCOMPANY_TRANSFER_CREATED",
            title: `Incoming Inter-Company Transfer: ${transfer.transfer_code}`,
            message: `Incoming transfer for '${asset.name}' (${asset.asset_tag}) initiated from origin company.`,
            severity: "INFO",
            entityType: "asset_transfers",
            entityId: transfer.id,
            actionUrl: `/transfers/${transfer.id}`
          }, client);
        }
      } else {
        await notificationService.notifyRole(fromCompanyId, "ASSET_MANAGER", {
          notificationType: "TRANSFER_CREATED",
          title: `Transfer Initiated: ${transfer.transfer_code}`,
          message: `Transfer for '${asset.name}' (${asset.asset_tag}) has been initiated.`,
          severity: "INFO",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      }

      return (await transfersRepository.findById(transfer.id, client))!;
    });
  }

  async approveTransfer(id: string, remarks: string | undefined, user: AuthUser): Promise<TransferWithDetails> {
    return await withTransaction(async (client) => {
      const transfer = await transfersRepository.findByIdWithLock(id, client);
      if (!transfer) {
        throw new NotFoundError(`Transfer '${id}' not found`);
      }

      assertCompanyAccess(user, transfer.from_company_id);

      // Verify status
      if (transfer.status !== "INITIATED" && transfer.status !== "PENDING_APPROVAL") {
        throw new BadRequestError(`Cannot approve transfer in status '${transfer.status}' (Must be INITIATED or PENDING_APPROVAL)`);
      }

      // Check role authority
      if (!user.isCommonAdmin && user.roleCode !== "COMPANY_ADMIN" && user.roleCode !== "ASSET_MANAGER" && user.roleCode !== "DEPT_MANAGER") {
        throw new ForbiddenError("Insufficient authority to authorize asset transfers");
      }

      // Update transfer status to APPROVED
      await transfersRepository.updateStatus(id, "APPROVED", {
        approved_by: user.id,
        remarks: remarks || transfer.remarks,
      }, client);

      // Audit & History
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'TRANSFER_APPROVED', 'asset_transfers', $3, $4::jsonb);
      `, [
        transfer.from_company_id,
        user.id,
        id,
        JSON.stringify({ transferCode: transfer.transfer_code, approvedBy: user.username, remarks })
      ]);

      // Notification
      await notificationService.notifyRole(transfer.from_company_id, "ASSET_MANAGER", {
        notificationType: "TRANSFER_APPROVED",
        title: `Transfer Approved: ${transfer.transfer_code}`,
        message: `Transfer '${transfer.transfer_code}' has been approved and is ready for physical dispatch.`,
        severity: "INFO",
        entityType: "asset_transfers",
        entityId: transfer.id,
        actionUrl: `/transfers/${transfer.id}`
      }, client);

      return (await transfersRepository.findById(id, client))!;
    });
  }

  async dispatchTransfer(id: string, user: AuthUser): Promise<TransferWithDetails> {
    return await withTransaction(async (client) => {
      const transfer = await transfersRepository.findByIdWithLock(id, client);
      if (!transfer) {
        throw new NotFoundError(`Transfer '${id}' not found`);
      }

      assertCompanyAccess(user, transfer.from_company_id);

      if (transfer.status !== "APPROVED") {
        throw new BadRequestError(`Cannot dispatch transfer in status '${transfer.status}' (Must be APPROVED)`);
      }

      // Lock asset and update status to IN_TRANSIT
      await client.query(`
        UPDATE assets
        SET status = 'IN_TRANSIT', updated_at = NOW()
        WHERE id = $1;
      `, [transfer.asset_id]);

      // Update transfer to DISPATCHED
      const now = new Date().toISOString();
      await transfersRepository.updateStatus(id, "DISPATCHED", {
        dispatched_by: user.id,
        dispatch_date: now,
      }, client);

      if (transfer.transfer_type === "INTER_COMPANY") {
        await transfersRepository.updateInterCompany(id, {
          dispatch_date: now,
          status: "PENDING_RECEIPT",
        }, client);
      }

      // History & Audit
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'TRANSFER_DISPATCHED', 'APPROVED', 'IN_TRANSIT', 'asset_transfers', $3, $4::jsonb);
      `, [
        transfer.asset_id,
        transfer.from_company_id,
        user.id,
        JSON.stringify({ transferCode: transfer.transfer_code, dispatchedBy: user.username })
      ]);

      // Notification to destination
      if (transfer.transfer_type === "INTER_COMPANY" && transfer.to_company_id) {
        await notificationService.notifyCompanyAdmins(transfer.to_company_id, {
          notificationType: "INTERCOMPANY_TRANSFER_RECEIPT_REQUIRED",
          title: `Action Required: Transfer Dispatched - ${transfer.transfer_code}`,
          message: `Asset '${transfer.asset_tag}' has been dispatched and requires destination confirmation of receipt.`,
          severity: "WARNING",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      } else if (transfer.to_company_id) {
        await notificationService.notifyRole(transfer.to_company_id, "ASSET_MANAGER", {
          notificationType: "TRANSFER_RECEIPT_REQUIRED",
          title: `Action Required: Transfer Dispatched - ${transfer.transfer_code}`,
          message: `Asset '${transfer.asset_tag}' has been dispatched and requires confirmation of receipt.`,
          severity: "WARNING",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      }

      return (await transfersRepository.findById(id, client))!;
    });
  }

  async confirmReceipt(id: string, input: ConfirmReceiptInput, user: AuthUser): Promise<TransferWithDetails> {
    return await withTransaction(async (client) => {
      const transfer = await transfersRepository.findByIdWithLock(id, client);
      if (!transfer) {
        throw new NotFoundError(`Transfer '${id}' not found`);
      }

      // State check
      if (transfer.status !== "DISPATCHED" && transfer.status !== "HANDOVER_PENDING") {
        throw new BadRequestError(
          `Cannot confirm receipt: Transfer is in status '${transfer.status}' (Must be DISPATCHED or HANDOVER_PENDING)`
        );
      }

      // DUAL AUTHORIZATION PROTOCOL: Receiving authorization MUST belong to destination company!
      if (!user.isCommonAdmin) {
        if (user.companyId !== transfer.to_company_id) {
          throw new ForbiddenError(
            `Dual authorization violation: Receipt must be confirmed by destination company '${transfer.to_company_code || transfer.to_company_id}'`
          );
        }
      }

      const now = new Date().toISOString();
      const conditionAfter = input.conditionAfter || transfer.condition_before || "GOOD";

      // 1. If INTER_COMPANY: Atomically execute Asset Ownership Re-Homing!
      if (transfer.transfer_type === "INTER_COMPANY") {
        // Complete any open active custody assignments in the old company
        await client.query(`
          UPDATE asset_assignments
          SET status = 'RETURNED'
          WHERE asset_id = $1 AND status = 'ACTIVE';
        `, [transfer.asset_id]);

        // Re-home the asset to the new company
        const nextStatus = input.destinationEmployeeId ? "ASSIGNED" : "AVAILABLE";
        await client.query(`
          UPDATE assets
          SET 
            company_id = $1,
            branch_id = $2,
            department_id = $3,
            location_id = $4,
            assigned_employee_id = $5,
            status = $6,
            condition = $7,
            updated_at = NOW()
          WHERE id = $8;
        `, [
          transfer.to_company_id,
          input.destinationBranchId || null,
          input.destinationDepartmentId || null,
          input.destinationLocationId || null,
          input.destinationEmployeeId || null,
          nextStatus,
          conditionAfter,
          transfer.asset_id,
        ]);

        // Update inter_company_transfers
        await transfersRepository.updateInterCompany(id, {
          status: "CONFIRMED",
          receiving_admin_id: user.id,
          receipt_date: now,
          acknowledgement_notes: input.acknowledgementNotes || "Asset received and inspected in good order",
        }, client);
      } else {
        // INTERNAL TRANSFER (Employee, Dept, or Location move)
        const nextStatus = transfer.transfer_type === "EMPLOYEE_TO_EMPLOYEE" ? "ASSIGNED" : "AVAILABLE";
        await client.query(`
          UPDATE assets
          SET 
            department_id = COALESCE($1, department_id),
            location_id = COALESCE($2, location_id),
            assigned_employee_id = $3,
            status = $4,
            condition = $5,
            updated_at = NOW()
          WHERE id = $6;
        `, [
          transfer.to_department_id || input.destinationDepartmentId || null,
          transfer.to_location_id || input.destinationLocationId || null,
          transfer.to_employee_id || input.destinationEmployeeId || null,
          nextStatus,
          conditionAfter,
          transfer.asset_id,
        ]);

        // Update custody assignment if employee-to-employee
        if (transfer.transfer_type === "EMPLOYEE_TO_EMPLOYEE" && transfer.to_employee_id) {
          // Close old assignment
          await client.query(`
            UPDATE asset_assignments
            SET status = 'RETURNED'
            WHERE asset_id = $1 AND status = 'ACTIVE';
          `, [transfer.asset_id]);

          // Create new active assignment
          await client.query(`
            INSERT INTO asset_assignments (
              asset_id, company_id, employee_id, assigned_by, condition_at_assignment, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6);
          `, [
            transfer.asset_id,
            transfer.to_company_id,
            transfer.to_employee_id,
            user.id,
            conditionAfter,
            `Assigned via Transfer ${transfer.transfer_code}`,
          ]);
        }
      }

      // 2. Physical Handover Record Creation
      const receiverEmpId = input.receiverId || input.destinationEmployeeId || transfer.to_employee_id;
      if (receiverEmpId) {
        await transfersRepository.createHandover({
          assetId: transfer.asset_id,
          transferId: transfer.id,
          senderId: transfer.from_employee_id,
          receiverId: receiverEmpId,
          condition: conditionAfter,
          physicalCondition: conditionAfter,
          remarks: input.acknowledgementNotes || "Physical delivery verified and accepted",
          digitalSignatureToken: input.signatureToken || `SIG-${Date.now()}`,
          verificationNotes: `Physical handover accepted under Transfer ${transfer.transfer_code}`,
          locationId: input.destinationLocationId || transfer.to_location_id,
        }, client);
      }

      // 3. Mark transfer COMPLETED
      await transfersRepository.updateStatus(id, "COMPLETED", {
        received_by: user.id,
        actual_delivery_date: now,
        condition_after: conditionAfter,
        remarks: input.acknowledgementNotes || transfer.remarks,
      }, client);

      // 4. Asset History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'TRANSFER_COMPLETED', 'IN_TRANSIT', 'AVAILABLE', 'asset_transfers', $3, $4::jsonb);
      `, [
        transfer.asset_id,
        transfer.to_company_id,
        user.id,
        JSON.stringify({
          transferCode: transfer.transfer_code,
          fromCompanyId: transfer.from_company_id,
          toCompanyId: transfer.to_company_id,
          receivedBy: user.username,
          conditionAfter
        })
      ]);

      // 5. Audit logs for both companies
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES 
        ($1, $2, 'TRANSFER_COMPLETED', 'asset_transfers', $3, $4::jsonb),
        ($5, $2, 'TRANSFER_COMPLETED', 'asset_transfers', $3, $4::jsonb);
      `, [
        transfer.from_company_id,
        user.id,
        id,
        JSON.stringify({ transferCode: transfer.transfer_code, status: "COMPLETED", toCompany: transfer.to_company_id }),
        transfer.to_company_id,
      ]);

      // 6. Notifications for both companies
      const completionMsg = `Transfer '${transfer.transfer_code}' for asset '${transfer.asset_tag}' has been confirmed and completed.`;
      await notificationService.notifyCompanyAdmins(transfer.from_company_id, {
        notificationType: "TRANSFER_COMPLETED",
        title: `Transfer Completed: ${transfer.transfer_code}`,
        message: completionMsg,
        severity: "SUCCESS",
        entityType: "asset_transfers",
        entityId: transfer.id,
        actionUrl: `/transfers/${transfer.id}`
      }, client);

      if (transfer.to_company_id && transfer.to_company_id !== transfer.from_company_id) {
        await notificationService.notifyCompanyAdmins(transfer.to_company_id, {
          notificationType: "TRANSFER_COMPLETED",
          title: `Transfer Completed: ${transfer.transfer_code}`,
          message: completionMsg,
          severity: "SUCCESS",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      }

      return (await transfersRepository.findById(id, client))!;
    });
  }

  async disputeTransfer(id: string, reason: string, user: AuthUser): Promise<TransferWithDetails> {
    if (!reason || !reason.trim()) {
      throw new ValidationError("Mandatory dispute reason is required to dispute a transfer");
    }

    return await withTransaction(async (client) => {
      const transfer = await transfersRepository.findByIdWithLock(id, client);
      if (!transfer) {
        throw new NotFoundError(`Transfer '${id}' not found`);
      }

      // Must be destination company or Common Admin
      if (!user.isCommonAdmin && user.companyId !== transfer.to_company_id) {
        throw new ForbiddenError("Only destination company administrator can dispute incoming transfer");
      }

      if (transfer.status !== "DISPATCHED" && transfer.status !== "HANDOVER_PENDING") {
        throw new BadRequestError(`Cannot dispute transfer in status '${transfer.status}'`);
      }

      // Update transfer and asset status to DISPUTED
      await client.query(`
        UPDATE assets
        SET status = 'DISPUTED', updated_at = NOW()
        WHERE id = $1;
      `, [transfer.asset_id]);

      await transfersRepository.updateStatus(id, "DISPUTED", {
        dispute_reason: reason.trim(),
      }, client);

      if (transfer.transfer_type === "INTER_COMPANY") {
        await transfersRepository.updateInterCompany(id, {
          status: "DISPUTED",
          dispute_reason: reason.trim(),
        }, client);
      }

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'TRANSFER_DISPUTED', 'asset_transfers', $3, $4::jsonb);
      `, [
        transfer.to_company_id,
        user.id,
        id,
        JSON.stringify({ transferCode: transfer.transfer_code, disputeReason: reason })
      ]);

      // Notifications for Dispute (CRITICAL!)
      const disputeType = transfer.transfer_type === "INTER_COMPANY" ? "INTERCOMPANY_TRANSFER_DISPUTED" : "TRANSFER_DISPUTED";
      const disputeMsg = `Transfer '${transfer.transfer_code}' has been DISPUTED by receiving company: ${reason.trim()}`;

      await notificationService.notifyCompanyAdmins(transfer.from_company_id, {
        notificationType: disputeType,
        title: `CRITICAL: Transfer Disputed - ${transfer.transfer_code}`,
        message: disputeMsg,
        severity: "CRITICAL",
        entityType: "asset_transfers",
        entityId: transfer.id,
        actionUrl: `/transfers/${transfer.id}`
      }, client);

      if (transfer.to_company_id && transfer.to_company_id !== transfer.from_company_id) {
        await notificationService.notifyCompanyAdmins(transfer.to_company_id, {
          notificationType: disputeType,
          title: `CRITICAL: Transfer Disputed - ${transfer.transfer_code}`,
          message: disputeMsg,
          severity: "CRITICAL",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      }

      if (transfer.transfer_type === "INTER_COMPANY") {
        await notificationService.notifyCommonAdmin({
          notificationType: disputeType,
          title: `Inter-Company Dispute Alert: ${transfer.transfer_code}`,
          message: disputeMsg,
          severity: "CRITICAL",
          entityType: "asset_transfers",
          entityId: transfer.id,
          actionUrl: `/transfers/${transfer.id}`
        }, client);
      }

      return (await transfersRepository.findById(id, client))!;
    });
  }

  async cancelTransfer(id: string, reason: string | undefined, user: AuthUser): Promise<TransferWithDetails> {
    return await withTransaction(async (client) => {
      const transfer = await transfersRepository.findByIdWithLock(id, client);
      if (!transfer) {
        throw new NotFoundError(`Transfer '${id}' not found`);
      }

      assertCompanyAccess(user, transfer.from_company_id);

      if (transfer.status === "DISPATCHED" || transfer.status === "COMPLETED") {
        throw new BadRequestError(`Cannot cancel transfer in '${transfer.status}' status. Transfer has already been dispatched.`);
      }

      if (transfer.status === "CANCELLED" || transfer.status === "REJECTED") {
        throw new ConflictError(`Transfer is already in terminal status '${transfer.status}'`);
      }

      // Restore asset status if needed
      await client.query(`
        UPDATE assets
        SET status = CASE WHEN assigned_employee_id IS NOT NULL THEN 'ASSIGNED' ELSE 'AVAILABLE' END, updated_at = NOW()
        WHERE id = $1;
      `, [transfer.asset_id]);

      await transfersRepository.updateStatus(id, "CANCELLED", {
        rejection_reason: reason || "Cancelled by user",
      }, client);

      return (await transfersRepository.findById(id, client))!;
    });
  }

  async listTransfers(options: ListTransfersOptions, user: AuthUser): Promise<{ transfers: TransferWithDetails[]; total: number }> {
    const targetCompanyId = user.isCommonAdmin
      ? (options.companyId || null)
      : user.companyId!;

    return await transfersRepository.list({
      ...options,
      companyId: targetCompanyId,
    });
  }

  async getTransferById(id: string, user: AuthUser): Promise<TransferWithDetails> {
    const transfer = await transfersRepository.findById(id);
    if (!transfer) {
      throw new NotFoundError(`Transfer '${id}' not found`);
    }

    if (!user.isCommonAdmin) {
      if (user.companyId !== transfer.from_company_id && user.companyId !== transfer.to_company_id) {
        throw new ForbiddenError("Cross-company violation: User does not belong to sender or recipient company");
      }
    }

    return transfer;
  }

  async listAssetTransfers(assetId: string, user: AuthUser): Promise<TransferWithDetails[]> {
    // Verify asset access
    const assetRes = await query(`SELECT id, company_id FROM assets WHERE id = $1;`, [assetId]);
    if (assetRes.rows.length === 0) {
      throw new NotFoundError(`Asset '${assetId}' not found`);
    }
    assertCompanyAccess(user, assetRes.rows[0].company_id);

    return await transfersRepository.listByAssetId(assetId);
  }
}

export const transfersService = new TransfersService();
