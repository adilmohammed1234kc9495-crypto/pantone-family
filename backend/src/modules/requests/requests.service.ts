import { withTransaction, query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import {
  assertCompanyAccess,
  assertDepartmentAccess,
} from "../../middleware/tenant.middleware";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  requestsRepository,
  AssetRequestWithDetails,
  RequestHistoryRow,
  UpdateRequestData,
  ListRequestsOptions,
} from "./requests.repository";
import { approvalsRepository } from "../approvals/approvals.repository";
import { approvalWorkflowsService } from "../approval-workflows/approval-workflows.service";
import { stockRepository } from "../stock/stock.repository";
import { assignmentsService } from "../assignments/assignments.service";
import { notificationService } from "../notifications/notification.service";

export interface CreateRequestInput {
  companyId?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  stockItemId?: string | null;
  itemName?: string | null;
  quantity?: number;
  justification: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requiredByDate?: string | null;
  preferredLocationId?: string | null;
}

export interface FulfillRequestInput {
  stockItemId?: string | null;
  existingAssetId?: string | null;
  fulfillmentNotes?: string | null;
}

export class RequestsService {
  async createRequest(input: CreateRequestInput, user: AuthUser): Promise<AssetRequestWithDetails> {
    const targetCompanyId = user.isCommonAdmin
      ? (input.companyId || user.companyId)
      : user.companyId!;

    if (!targetCompanyId) {
      throw new ValidationError("Company ID is required to create requisition");
    }

    assertCompanyAccess(user, targetCompanyId);

    // Resolve employee
    let targetEmployeeId = input.employeeId;
    if (!targetEmployeeId && user.employeeId) {
      targetEmployeeId = user.employeeId;
    }
    if (!targetEmployeeId) {
      // Find employee associated with user or default
      const empRes = await query(`SELECT id, department_id FROM employees WHERE company_id = $1 LIMIT 1;`, [targetCompanyId]);
      if (empRes.rows.length === 0) {
        throw new NotFoundError("No eligible employee record found for requisition");
      }
      targetEmployeeId = empRes.rows[0].id;
    }

    // Verify employee belongs to target company
    const empCheck = await query(`SELECT id, company_id, department_id FROM employees WHERE id = $1;`, [targetEmployeeId]);
    if (empCheck.rows.length === 0) {
      throw new NotFoundError(`Employee '${targetEmployeeId}' not found`);
    }
    if (empCheck.rows[0].company_id !== targetCompanyId) {
      throw new BadRequestError("Cross-company violation: Employee belongs to a different company");
    }

    const resolvedDeptId = input.departmentId || empCheck.rows[0].department_id;

    if (!input.justification || !input.justification.trim()) {
      throw new ValidationError("Justification is required for asset requisition");
    }

    return await withTransaction(async (client) => {
      const request = await requestsRepository.create({
        companyId: targetCompanyId,
        requesterId: user.id,
        employeeId: targetEmployeeId!,
        departmentId: resolvedDeptId || null,
        categoryId: input.categoryId || null,
        stockItemId: input.stockItemId || null,
        itemName: input.itemName || null,
        quantity: input.quantity || 1,
        justification: input.justification.trim(),
        priority: input.priority || "MEDIUM",
        requiredByDate: input.requiredByDate || null,
        preferredLocationId: input.preferredLocationId || null,
      }, client);

      // Record history
      await requestsRepository.addHistory({
        requestId: request.id,
        companyId: targetCompanyId,
        action: "REQUEST_CREATED",
        fromStatus: null,
        toStatus: "DRAFT",
        performedBy: user.id,
        remarks: "Requisition draft created",
      }, client);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_CREATED', 'asset_requests', $3, $4::jsonb);
      `, [
        targetCompanyId,
        user.id,
        request.id,
        JSON.stringify({
          requestNumber: request.request_number,
          priority: request.priority,
          quantity: request.quantity,
          justification: request.justification
        })
      ]);

      const fullRequest = await requestsRepository.findById(request.id, client);
      return fullRequest!;
    });
  }

  async updateRequest(id: string, input: UpdateRequestData, user: AuthUser): Promise<AssetRequestWithDetails> {
    const existing = await requestsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError(`Cannot edit requisition: Current status is '${existing.status}' (Must be DRAFT)`);
    }

    // Verify employee role ownership
    if (user.roleCode === "EMPLOYEE" && existing.requester_id !== user.id) {
      throw new ForbiddenError("Employees can only edit their own draft requisitions");
    }

    return await withTransaction(async (client) => {
      const updated = await requestsRepository.update(id, input, client);

      await requestsRepository.addHistory({
        requestId: id,
        companyId: existing.company_id,
        action: "REQUEST_UPDATED",
        fromStatus: existing.status,
        toStatus: existing.status,
        performedBy: user.id,
        remarks: "Requisition details updated",
      }, client);

      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, old_values_json, new_values_json
        ) VALUES ($1, $2, 'REQUEST_UPDATED', 'asset_requests', $3, $4::jsonb, $5::jsonb);
      `, [
        existing.company_id,
        user.id,
        id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      ]);

      const fullRequest = await requestsRepository.findById(id, client);
      return fullRequest!;
    });
  }

  async submitRequest(id: string, user: AuthUser): Promise<AssetRequestWithDetails> {
    const existing = await requestsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    if (existing.status !== "DRAFT") {
      throw new ConflictError(`Cannot submit requisition: Current status is '${existing.status}' (Only DRAFT requisitions can be submitted)`);
    }

    return await withTransaction(async (client) => {
      // 1. Resolve active workflow for this company
      const workflow = await approvalWorkflowsService.getActiveWorkflow(existing.company_id, "ASSET_REQUEST");
      if (!workflow.steps || workflow.steps.length === 0) {
        throw new BadRequestError("No approval stages configured for this company");
      }

      // 2. Generate approval stage rows
      for (const step of workflow.steps) {
        await approvalsRepository.createStage({
          requestId: id,
          stepNumber: step.step_order,
          approvalLevel: step.step_order,
          approverRole: step.role_code,
          status: "PENDING",
        }, client);
      }

      // 3. Update request status to PENDING_APPROVAL at Level 1
      await requestsRepository.updateStatus(id, "PENDING_APPROVAL", 1, {}, client);

      // 4. Record history
      await requestsRepository.addHistory({
        requestId: id,
        companyId: existing.company_id,
        action: "REQUEST_SUBMITTED",
        fromStatus: "DRAFT",
        toStatus: "PENDING_APPROVAL",
        performedBy: user.id,
        remarks: `Requisition submitted for ${workflow.steps.length}-stage approval process`,
      }, client);

      // 5. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_SUBMITTED', 'asset_requests', $3, $4::jsonb);
      `, [
        existing.company_id,
        user.id,
        id,
        JSON.stringify({
          requestNumber: existing.request_number,
          workflowId: workflow.id,
          stagesCount: workflow.steps.length,
          firstStageRole: workflow.steps[0].role_code
        })
      ]);

      // 6. Notify requester
      await notificationService.create({
        userId: user.id,
        companyId: existing.company_id,
        notificationType: "REQUISITION_SUBMITTED",
        title: `Requisition Submitted: ${existing.request_number}`,
        message: `Your requisition '${existing.request_number}' (${existing.item_name || "Asset"}) has been submitted for approval.`,
        severity: "INFO",
        entityType: "asset_requests",
        entityId: id,
        actionUrl: `/requests/${id}`,
        idempotencyKey: `REQ_SUBMITTED:${id}`
      }, client);

      // 7. Notify level 1 approvers
      const firstRole = workflow.steps[0].role_code;
      await notificationService.notifyRole(
        existing.company_id,
        firstRole,
        {
          notificationType: "REQUISITION_APPROVAL_REQUIRED",
          title: `Requisition Pending Approval: ${existing.request_number}`,
          message: `Request for '${existing.item_name || "Asset"}' requires your authorization as ${firstRole}.`,
          severity: "WARNING",
          type: "INFO",
          entityType: "asset_requests",
          entityId: id,
          actionUrl: `/requests/${id}`,
          idempotencyKey: `REQ_APPROVE:${id}:1`
        },
        client
      );

      const fullRequest = await requestsRepository.findById(id, client);
      return fullRequest!;
    });
  }

  async cancelRequest(id: string, user: AuthUser): Promise<AssetRequestWithDetails> {
    const existing = await requestsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    if (existing.status === "APPROVED" || existing.status === "FULFILLED") {
      throw new BadRequestError(`Cannot cancel requisition: It is already in status '${existing.status}'`);
    }
    if (existing.status === "CANCELLED") {
      throw new BadRequestError("Requisition is already cancelled");
    }

    // Role check: Only requester, company admin, or common admin can cancel
    if (user.roleCode === "EMPLOYEE" && existing.requester_id !== user.id) {
      throw new ForbiddenError("Employees can only cancel their own requisitions");
    }

    return await withTransaction(async (client) => {
      await requestsRepository.updateStatus(id, "CANCELLED", undefined, {}, client);

      // Cancel any pending approval stages
      await approvalsRepository.cancelRemainingStages(id, 0, client);

      await requestsRepository.addHistory({
        requestId: id,
        companyId: existing.company_id,
        action: "REQUEST_CANCELLED",
        fromStatus: existing.status,
        toStatus: "CANCELLED",
        performedBy: user.id,
        remarks: "Requisition cancelled by user",
      }, client);

      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_CANCELLED', 'asset_requests', $3, $4::jsonb);
      `, [
        existing.company_id,
        user.id,
        id,
        JSON.stringify({ requestNumber: existing.request_number, previousStatus: existing.status })
      ]);

      const fullRequest = await requestsRepository.findById(id, client);
      return fullRequest!;
    });
  }

  async fulfillRequest(id: string, input: FulfillRequestInput, user: AuthUser): Promise<AssetRequestWithDetails> {
    const existing = await requestsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    if (existing.status !== "APPROVED") {
      throw new ConflictError(`Cannot fulfill requisition: Request must be in 'APPROVED' status (Current status is '${existing.status}')`);
    }

    return await withTransaction(async (client) => {
      let fulfilledStockMovementId: string | null = null;
      let fulfilledAssetId: string | null = null;

      // Mode A: Stock Item Fulfillment
      const targetStockItemId = input.stockItemId || existing.stock_item_id;
      if (targetStockItemId) {
        // Lock stock item row to guarantee stock availability
        const stockItem = await stockRepository.findWithLock(targetStockItemId, client);
        if (!stockItem) {
          throw new NotFoundError(`Fulfillment stock item '${targetStockItemId}' not found`);
        }
        if (stockItem.company_id !== existing.company_id) {
          throw new BadRequestError("Cross-company violation: Fulfillment stock belongs to a different company");
        }

        const requiredQty = existing.quantity || 1;
        if (stockItem.quantity_on_hand < requiredQty) {
          throw new BadRequestError(
            `Insufficient stock to fulfill request: Available ${stockItem.quantity_on_hand}, required ${requiredQty}`
          );
        }

        const balanceBefore = stockItem.quantity_on_hand;
        const balanceAfter = balanceBefore - requiredQty;

        await stockRepository.updateQuantity(stockItem.id, balanceAfter, client);

        const movement = await stockRepository.recordMovement({
          companyId: existing.company_id,
          stockItemId: stockItem.id,
          movementType: "ISSUE",
          quantity: requiredQty,
          unitCost: stockItem.unit_cost,
          balanceBefore,
          balanceAfter,
          performedBy: user.id,
          referenceType: "ASSET_REQUEST",
          referenceId: existing.id,
          notes: `Fulfillment of requisition ${existing.request_number} for ${existing.employee_first_name} ${existing.employee_last_name}`,
        }, client);

        fulfilledStockMovementId = movement.id;
      }

      // Mode B: Serialized Fixed Asset Custody Fulfillment
      const targetAssetId = input.existingAssetId || existing.specific_asset_id;
      if (targetAssetId) {
        // Verify asset exists, belongs to same company, and is in AVAILABLE state
        const assetRes = await client.query(
          `SELECT id, company_id, status, asset_tag, name FROM assets WHERE id = $1;`,
          [targetAssetId]
        );
        if (assetRes.rows.length === 0) {
          throw new NotFoundError(`Fulfillment asset '${targetAssetId}' not found`);
        }
        const asset = assetRes.rows[0];
        if (asset.company_id !== existing.company_id) {
          throw new BadRequestError("Cross-company violation: Fulfillment asset belongs to a different company");
        }
        if (asset.status !== "AVAILABLE" && asset.status !== "IN_STOCK") {
          throw new ConflictError(
            `Asset '${asset.asset_tag}' cannot be assigned for fulfillment because its current status is '${asset.status}'`
          );
        }

        // Reuse Phase 5 assignment service
        const assignment = await assignmentsService.assignAsset({
          assetId: asset.id,
          employeeId: existing.employee_id,
          conditionAtAssignment: "EXCELLENT",
          remarks: `Fulfilled via Requisition ${existing.request_number}`,
        }, user);

        await assignmentsService.confirmHandover(assignment.id, {
          condition: "EXCELLENT",
          remarks: `Physical delivery upon requisition fulfillment`,
        }, user);

        fulfilledAssetId = asset.id;
      }

      if (!fulfilledStockMovementId && !fulfilledAssetId) {
        throw new ValidationError("Fulfillment requires specifying either a valid stock item or an available fixed asset");
      }

      // Update request status to FULFILLED
      await requestsRepository.updateStatus(id, "FULFILLED", undefined, {
        fulfilled_by: user.id,
        fulfilled_at: new Date().toISOString(),
        fulfilled_asset_id: fulfilledAssetId,
        fulfilled_stock_movement_id: fulfilledStockMovementId,
        fulfillment_notes: input.fulfillmentNotes || "Requisition successfully fulfilled",
      }, client);

      // Record history
      await requestsRepository.addHistory({
        requestId: id,
        companyId: existing.company_id,
        action: "REQUEST_FULFILLED",
        fromStatus: "APPROVED",
        toStatus: "FULFILLED",
        performedBy: user.id,
        remarks: input.fulfillmentNotes || "Requisition fulfilled",
        metadata: {
          fulfilledStockMovementId,
          fulfilledAssetId
        }
      }, client);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_FULFILLED', 'asset_requests', $3, $4::jsonb);
      `, [
        existing.company_id,
        user.id,
        id,
        JSON.stringify({
          requestNumber: existing.request_number,
          fulfilledStockMovementId,
          fulfilledAssetId,
          notes: input.fulfillmentNotes
        })
      ]);

      // Notify requester
      if (existing.requester_id) {
        await notificationService.create({
          userId: existing.requester_id,
          companyId: existing.company_id,
          notificationType: "REQUISITION_FULFILLED",
          title: `Requisition Fulfilled: ${existing.request_number}`,
          message: `Your request for '${existing.item_name || "Asset"}' has been fulfilled.`,
          severity: "SUCCESS",
          type: "SUCCESS",
          entityType: "asset_requests",
          entityId: id,
          actionUrl: `/requests/${id}`,
          idempotencyKey: `REQ_FULFILLED:${id}`
        }, client);
      }

      const fullRequest = await requestsRepository.findById(id, client);
      return fullRequest!;
    });
  }

  async getRequestById(id: string, user: AuthUser): Promise<AssetRequestWithDetails> {
    const request = await requestsRepository.findById(id);
    if (!request) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, request.company_id);

    if (user.roleCode === "DEPT_MANAGER" && request.department_id) {
      assertDepartmentAccess(user, request.department_id);
    }

    if (user.roleCode === "EMPLOYEE") {
      const isOwner = (user.employeeId && user.employeeId === request.employee_id) || (user.id === request.requester_id);
      if (!isOwner) {
        throw new ForbiddenError("Access restricted: You may only view your own requisitions.");
      }
    }

    return request;
  }

  async listRequests(options: ListRequestsOptions, user: AuthUser): Promise<{ requests: AssetRequestWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const targetCompanyId = user.isCommonAdmin
      ? (options.companyId || null)
      : user.companyId!;

    let departmentId = options.departmentId;
    let employeeId = options.employeeId;
    let requesterId = options.requesterId;

    if (user.roleCode === "DEPT_MANAGER") {
      departmentId = user.departmentId || undefined;
    } else if (user.roleCode === "EMPLOYEE") {
      requesterId = user.id;
      if (user.employeeId) {
        employeeId = user.employeeId;
      }
    }

    return await requestsRepository.list({
      ...options,
      companyId: targetCompanyId,
      departmentId,
      employeeId,
      requesterId
    });
  }

  async getRequestHistory(id: string, user: AuthUser): Promise<RequestHistoryRow[]> {
    const request = await requestsRepository.findById(id);
    if (!request) {
      throw new NotFoundError(`Requisition '${id}' not found`);
    }

    assertCompanyAccess(user, request.company_id);
    return await requestsRepository.listHistory(id);
  }
}

export const requestsService = new RequestsService();
