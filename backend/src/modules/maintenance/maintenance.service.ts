import crypto from "crypto";
import { withTransaction, query } from "../../config/database";
import { 
  maintenanceRepository, 
  MaintenanceWithDetails, 
  ListMaintenanceOptions 
} from "./maintenance.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ValidationError, ForbiddenError, BadRequestError } from "../../utils/errors";
import { notificationService } from "../notifications/notification.service";

export interface CreateWorkOrderInput {
  assetId: string;
  problem: string;
  vendorId?: string | null;
  technicianName?: string | null;
  estimatedCost?: number;
  maintenanceType?: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "CALIBRATION" | "UPGRADE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description?: string | null;
  inspectionId?: string | null;
}

export interface TransitionStatusInput {
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "VERIFIED" | "CLOSED" | "CANCELLED";
  technicianName?: string | null;
  remarks?: string | null;
  actualCost?: number | null;
}

export interface UpdateCostsInput {
  actualCost: number;
  currency?: string;
  invoiceReference?: string | null;
  remarks?: string | null;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "COMPLETED"],
  WAITING_PARTS: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
  REPORTED: ["OPEN", "APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ASSIGNED", "CANCELLED"]
};

export class MaintenanceService {
  async createWorkOrder(input: CreateWorkOrderInput, user: AuthUser): Promise<MaintenanceWithDetails> {
    if (!input.assetId || !input.problem) {
      throw new ValidationError("Asset ID and problem description are required to create a work order");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot create maintenance work orders");
    }

    return await withTransaction(async (client) => {
      // 1. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, status, assigned_employee_id FROM assets WHERE id = $1 FOR UPDATE
      `, [input.assetId]);

      if (assetRes.rows.length === 0) {
        throw new NotFoundError(`Asset '${input.assetId}' not found`);
      }
      const asset = assetRes.rows[0];

      assertCompanyAccess(user, asset.company_id);

      // Asset cannot be in custody when entering maintenance
      if (asset.status === "ASSIGNED") {
        throw new ValidationError("Asset is currently assigned to an employee and must be returned before entering maintenance");
      }

      // 2. Generate unique work order and maintenance codes
      const yr = new Date().getFullYear();
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      const workOrderNumber = `WO-${yr}-${rand}`;
      const maintenanceCode = `MNT-${yr}-${rand}`;

      // 3. Create maintenance record
      const workOrder = await maintenanceRepository.create({
        maintenanceCode,
        workOrderNumber,
        assetId: asset.id,
        companyId: asset.company_id,
        problem: input.problem,
        reportedBy: user.id,
        vendorId: input.vendorId || null,
        technicianName: input.technicianName || null,
        estimatedCost: input.estimatedCost || 0.00,
        maintenanceType: input.maintenanceType || "CORRECTIVE",
        priority: input.priority || "MEDIUM",
        description: input.description || null,
        inspectionId: input.inspectionId || null
      }, client);

      // 4. Update asset status to UNDER_MAINTENANCE
      await client.query(`
        UPDATE assets
        SET status = 'UNDER_MAINTENANCE'
        WHERE id = $1
      `, [asset.id]);

      // 5. Immutable History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'MAINTENANCE_CREATED', $3, 'UNDER_MAINTENANCE', 'maintenance_records', $4, $5::jsonb)
      `, [
        asset.id,
        asset.company_id,
        asset.status,
        user.id,
        JSON.stringify({
          workOrderId: workOrder.id,
          workOrderNumber,
          problem: input.problem,
          type: input.maintenanceType || "CORRECTIVE",
          priority: input.priority || "MEDIUM"
        })
      ]);

      // 6. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'MAINTENANCE_WORK_ORDER_CREATED', 'maintenance_records', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        workOrder.id,
        JSON.stringify(workOrder)
      ]);

      // 7. Notification for asset manager
      await notificationService.notifyRole(
        asset.company_id,
        "ASSET_MANAGER",
        {
          notificationType: "MAINTENANCE_CREATED",
          title: `Maintenance Ticket: ${workOrderNumber}`,
          message: `Work order '${workOrderNumber}' created for asset '${asset.name}' (${asset.asset_tag}) with priority '${input.priority || "MEDIUM"}'.`,
          severity: input.priority === "CRITICAL" ? "CRITICAL" : "INFO",
          entityType: "maintenance_records",
          entityId: workOrder.id,
          actionUrl: `/maintenance`,
          idempotencyKey: `MAINT_CREATED:${workOrder.id}`
        },
        client
      );

      const fullDetails = await maintenanceRepository.findById(workOrder.id, client);
      return fullDetails!;
    });
  }

  async transitionStatus(id: string, input: TransitionStatusInput, user: AuthUser): Promise<MaintenanceWithDetails> {
    if (!input.status) {
      throw new ValidationError("Target status is required");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot transition maintenance work order statuses");
    }

    return await withTransaction(async (client) => {
      // 1. Lock work order
      const woRes = await client.query(`
        SELECT * FROM maintenance_records WHERE id = $1 FOR UPDATE
      `, [id]);

      if (woRes.rows.length === 0) {
        throw new NotFoundError(`Maintenance work order '${id}' not found`);
      }
      const workOrder = woRes.rows[0];

      assertCompanyAccess(user, workOrder.company_id);

      const currentStatus = workOrder.status;
      const targetStatus = input.status;

      // 2. Validate state machine transition
      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestError(
          `Invalid work order status transition from '${currentStatus}' to '${targetStatus}'. Permitted transitions: [${allowed.join(", ")}]`
        );
      }

      // 3. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, status FROM assets WHERE id = $1 FOR UPDATE
      `, [workOrder.asset_id]);
      const asset = assetRes.rows[0];

      let startDate = workOrder.start_date;
      let endDate = workOrder.end_date;
      let completedBy = workOrder.completed_by;
      let verifiedBy = workOrder.verified_by;
      let verifiedAt = workOrder.verified_at;
      let closedAt = workOrder.closed_at;

      if (targetStatus === "IN_PROGRESS" && !startDate) {
        startDate = new Date().toISOString().split("T")[0];
      } else if (targetStatus === "COMPLETED") {
        endDate = new Date().toISOString().split("T")[0];
        completedBy = user.id;
      } else if (targetStatus === "VERIFIED") {
        verifiedBy = user.id;
        verifiedAt = new Date().toISOString();
      } else if (targetStatus === "CLOSED") {
        closedAt = new Date().toISOString();
        // Restore asset to AVAILABLE
        await client.query(`
          UPDATE assets SET status = 'AVAILABLE', condition = 'GOOD' WHERE id = $1
        `, [asset.id]);

        await client.query(`
          INSERT INTO asset_history (
            asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
          ) VALUES ($1, $2, 'MAINTENANCE_CLOSED_RESTORED', 'UNDER_MAINTENANCE', 'AVAILABLE', 'maintenance_records', $3, $4::jsonb)
        `, [
          asset.id,
          asset.company_id,
          user.id,
          JSON.stringify({ workOrderId: workOrder.id, workOrderNumber: workOrder.work_order_number })
        ]);

      } else if (targetStatus === "CANCELLED") {
        // Restore asset to AVAILABLE if cancelled
        await client.query(`
          UPDATE assets SET status = 'AVAILABLE' WHERE id = $1
        `, [asset.id]);

        await client.query(`
          INSERT INTO asset_history (
            asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
          ) VALUES ($1, $2, 'MAINTENANCE_CANCELLED_RESTORED', 'UNDER_MAINTENANCE', 'AVAILABLE', 'maintenance_records', $3, $4::jsonb)
        `, [
          asset.id,
          asset.company_id,
          user.id,
          JSON.stringify({ workOrderId: workOrder.id, workOrderNumber: workOrder.work_order_number })
        ]);
      }

      // 4. Update work order status
      await maintenanceRepository.updateStatus(workOrder.id, {
        status: targetStatus,
        technicianName: input.technicianName || workOrder.technician_name,
        remarks: input.remarks || workOrder.remarks,
        actualCost: input.actualCost !== undefined ? input.actualCost : workOrder.actual_cost,
        startDate,
        endDate,
        completedBy,
        verifiedBy,
        verifiedAt,
        closedAt
      }, client);

      // 5. History Ledger
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'MAINTENANCE_STATUS_TRANSITION', $3, $4, 'maintenance_records', $5, $6::jsonb)
      `, [
        asset.id,
        asset.company_id,
        currentStatus,
        targetStatus,
        user.id,
        JSON.stringify({
          workOrderId: workOrder.id,
          workOrderNumber: workOrder.work_order_number,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          remarks: input.remarks || null
        })
      ]);

      // 6. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'MAINTENANCE_STATUS_TRANSITIONED', 'maintenance_records', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        workOrder.id,
        JSON.stringify({ from: currentStatus, to: targetStatus })
      ]);

      // 7. Notification on status transitions
      if (targetStatus === "COMPLETED") {
        await notificationService.notifyRole(
          asset.company_id,
          "ASSET_MANAGER",
          {
            notificationType: "MAINTENANCE_COMPLETED",
            title: `Maintenance Completed: ${workOrder.work_order_number}`,
            message: `Work order '${workOrder.work_order_number}' for asset '${asset.name}' has been completed.`,
            severity: "SUCCESS",
            entityType: "maintenance_records",
            entityId: workOrder.id,
            actionUrl: `/maintenance`,
            idempotencyKey: `MAINT_COMPLETED:${workOrder.id}`
          },
          client
        );
      } else if (targetStatus === "IN_PROGRESS") {
        await notificationService.notifyRole(
          asset.company_id,
          "ASSET_MANAGER",
          {
            notificationType: "MAINTENANCE_IN_PROGRESS",
            title: `Maintenance Started: ${workOrder.work_order_number}`,
            message: `Work order '${workOrder.work_order_number}' is now in progress with technician '${input.technicianName || workOrder.technician_name || "Assigned"}'.`,
            severity: "INFO",
            entityType: "maintenance_records",
            entityId: workOrder.id,
            actionUrl: `/maintenance`,
            idempotencyKey: `MAINT_IN_PROGRESS:${workOrder.id}`
          },
          client
        );
      }

      const fullDetails = await maintenanceRepository.findById(workOrder.id, client);
      return fullDetails!;
    });
  }

  async recordCosts(id: string, input: UpdateCostsInput, user: AuthUser): Promise<MaintenanceWithDetails> {
    if (input.actualCost === undefined || isNaN(input.actualCost)) {
      throw new ValidationError("Valid numeric actual cost is required");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot record maintenance costs");
    }

    const workOrder = await maintenanceRepository.findById(id);
    if (!workOrder) {
      throw new NotFoundError(`Maintenance work order '${id}' not found`);
    }

    assertCompanyAccess(user, workOrder.company_id);

    const updated = await maintenanceRepository.updateCosts(id, {
      actualCost: input.actualCost,
      currency: input.currency || "USD",
      invoiceReference: input.invoiceReference || null,
      remarks: input.remarks || null
    });

    await query(`
      INSERT INTO audit_logs (
        company_id, user_id, action, entity, entity_id, new_values_json
      ) VALUES ($1, $2, 'MAINTENANCE_COST_RECORDED', 'maintenance_records', $3, $4::jsonb)
    `, [
      workOrder.company_id,
      user.id,
      id,
      JSON.stringify(updated)
    ]);

    const fullDetails = await maintenanceRepository.findById(id);
    return fullDetails!;
  }

  async getWorkOrderById(id: string, user: AuthUser): Promise<MaintenanceWithDetails> {
    const workOrder = await maintenanceRepository.findById(id);
    if (!workOrder) {
      throw new NotFoundError(`Maintenance work order '${id}' not found`);
    }

    assertCompanyAccess(user, workOrder.company_id);
    return workOrder;
  }

  async listWorkOrders(options: ListMaintenanceOptions, user: AuthUser): Promise<{ workOrders: MaintenanceWithDetails[]; total: number }> {
    const filterOptions: ListMaintenanceOptions = { ...options };

    if (!user.isCommonAdmin) {
      filterOptions.companyId = user.companyId!;
    }

    return await maintenanceRepository.list(filterOptions);
  }
}

export const maintenanceService = new MaintenanceService();