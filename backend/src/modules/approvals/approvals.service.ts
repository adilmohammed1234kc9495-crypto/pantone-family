import { withTransaction } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import {
  assertCompanyAccess,
} from "../../middleware/tenant.middleware";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  approvalsRepository,
  ApprovalWithDetails,
} from "./approvals.repository";
import { requestsRepository } from "../requests/requests.repository";
import { notificationService } from "../notifications/notification.service";

export class ApprovalsService {
  async approve(
    requestId: string,
    approvalId: string,
    remarks: string | undefined,
    actor: AuthUser
  ): Promise<ApprovalWithDetails> {
    return await withTransaction(async (client) => {
      // 1. Lock approval row
      const approval = await approvalsRepository.findByIdWithLock(approvalId, client);
      if (!approval) {
        throw new NotFoundError(`Approval step '${approvalId}' not found`);
      }
      if (approval.request_id !== requestId) {
        throw new BadRequestError("Approval step does not belong to the specified requisition");
      }

      assertCompanyAccess(actor, approval.company_id);

      // Verify request status
      if (approval.request_status !== "PENDING_APPROVAL" && approval.request_status !== "PARTIALLY_APPROVED") {
        throw new BadRequestError(
          `Cannot approve: Requisition is in status '${approval.request_status}' (Must be PENDING_APPROVAL)`
        );
      }

      // Verify approval step status
      if (approval.status !== "PENDING") {
        throw new ConflictError(`Approval step is already decided with status '${approval.status}'`);
      }

      // Verify approval level (Cannot skip levels)
      if (approval.approval_level !== approval.current_approval_level) {
        throw new BadRequestError(
          `Cannot skip approval levels: Current active level is ${approval.current_approval_level}, requested step is level ${approval.approval_level}`
        );
      }

      // Verify role authority
      if (!actor.isCommonAdmin) {
        const isAuthorizedRole = 
          actor.roleCode === approval.approver_role || 
          actor.roleCode === "COMPANY_ADMIN";

        if (!isAuthorizedRole) {
          throw new ForbiddenError(
            `Unauthorized approver: Role '${actor.roleCode}' cannot approve stage requiring '${approval.approver_role}'`
          );
        }

        // Department scoping for DEPT_MANAGER
        if (approval.approver_role === "DEPT_MANAGER" && actor.roleCode === "DEPT_MANAGER") {
          if (approval.department_id && actor.departmentId !== approval.department_id) {
            throw new ForbiddenError("Department managers can only approve requisitions within their own department");
          }
        }

        // Self-approval restriction
        if (actor.id === approval.requester_id) {
          throw new ForbiddenError("Self-approval prohibited: Requester cannot authorize their own requisition");
        }
      }

      // 2. Mark this step approved
      await approvalsRepository.updateDecision(approvalId, {
        status: "APPROVED",
        decision: "APPROVED",
        approverId: actor.id,
        remarks: remarks || "Approved",
      }, client);

      // 3. Check for next approval stage
      const nextStepRes = await client.query(`
        SELECT * FROM asset_request_approvals 
        WHERE request_id = $1 AND approval_level > $2 AND status = 'PENDING'
        ORDER BY approval_level ASC 
        LIMIT 1;
      `, [requestId, approval.approval_level]);

      if (nextStepRes.rows.length > 0) {
        const nextStep = nextStepRes.rows[0];
        // Advance to next level
        await requestsRepository.updateStatus(
          requestId,
          "PARTIALLY_APPROVED",
          nextStep.approval_level,
          {},
          client
        );

        await requestsRepository.addHistory({
          requestId,
          companyId: approval.company_id,
          action: "REQUEST_STAGE_APPROVED",
          fromStatus: approval.request_status,
          toStatus: "PENDING_APPROVAL",
          performedBy: actor.id,
          remarks: `Level ${approval.approval_level} approved by ${actor.username}. Advanced to Level ${nextStep.approval_level} (${nextStep.approver_role})`,
          metadata: { approvalId, level: approval.approval_level, nextLevel: nextStep.approval_level }
        }, client);

        // Notify next level approver
        await notificationService.notifyRole(
          approval.company_id,
          nextStep.approver_role,
          {
            notificationType: "REQUISITION_APPROVAL_REQUIRED",
            title: `Requisition Level ${nextStep.approval_level} Pending: ${approval.request_number}`,
            message: `Requisition has been approved at Level ${approval.approval_level} and requires your authorization as ${nextStep.approver_role}.`,
            severity: "WARNING",
            type: "INFO",
            entityType: "asset_requests",
            entityId: requestId,
            actionUrl: `/requests/${requestId}`,
            idempotencyKey: `REQ_STAGE:${requestId}:${nextStep.approval_level}`
          },
          client
        );
      } else {
        // Final Level Approval! Requisition is fully APPROVED
        await requestsRepository.updateStatus(
          requestId,
          "APPROVED",
          approval.approval_level,
          {
            approver_id: actor.id,
            approved_at: new Date().toISOString()
          },
          client
        );

        await requestsRepository.addHistory({
          requestId,
          companyId: approval.company_id,
          action: "REQUEST_APPROVED",
          fromStatus: approval.request_status,
          toStatus: "APPROVED",
          performedBy: actor.id,
          remarks: `Final authorization completed by ${actor.username}`,
          metadata: { approvalId, level: approval.approval_level }
        }, client);

        // Audit Log
        await client.query(`
          INSERT INTO audit_logs (
            company_id, user_id, action, entity, entity_id, new_values_json
          ) VALUES ($1, $2, 'REQUEST_APPROVED', 'asset_requests', $3, $4::jsonb);
        `, [
          approval.company_id,
          actor.id,
          requestId,
          JSON.stringify({ requestNumber: approval.request_number, approvedBy: actor.username })
        ]);

        // Notify requester
        if (approval.requester_id) {
          await notificationService.create({
            userId: approval.requester_id,
            companyId: approval.company_id,
            notificationType: "REQUISITION_APPROVED",
            title: `Requisition Approved: ${approval.request_number}`,
            message: `Your requisition has received final approval and is ready for fulfillment.`,
            severity: "SUCCESS",
            type: "SUCCESS",
            entityType: "asset_requests",
            entityId: requestId,
            actionUrl: `/requests/${requestId}`,
            idempotencyKey: `REQ_APPROVED:${requestId}`
          }, client);
        }
      }

      const updated = await approvalsRepository.findByIdWithLock(approvalId, client);
      return updated!;
    });
  }

  async reject(
    requestId: string,
    approvalId: string,
    remarks: string,
    actor: AuthUser
  ): Promise<ApprovalWithDetails> {
    if (!remarks || !remarks.trim()) {
      throw new ValidationError("Rejection remarks are required");
    }

    return await withTransaction(async (client) => {
      const approval = await approvalsRepository.findByIdWithLock(approvalId, client);
      if (!approval) {
        throw new NotFoundError(`Approval step '${approvalId}' not found`);
      }
      if (approval.request_id !== requestId) {
        throw new BadRequestError("Approval step does not belong to the specified requisition");
      }

      assertCompanyAccess(actor, approval.company_id);

      if (approval.status !== "PENDING") {
        throw new ConflictError(`Approval step is already decided with status '${approval.status}'`);
      }

      if (!actor.isCommonAdmin) {
        const isAuthorizedRole = 
          actor.roleCode === approval.approver_role || 
          actor.roleCode === "COMPANY_ADMIN";

        if (!isAuthorizedRole) {
          throw new ForbiddenError(`Unauthorized approver: Role '${actor.roleCode}' cannot reject this stage`);
        }
      }

      // Mark step rejected
      await approvalsRepository.updateDecision(approvalId, {
        status: "REJECTED",
        decision: "REJECTED",
        approverId: actor.id,
        remarks: remarks.trim(),
      }, client);

      // Cancel all remaining approval steps
      await approvalsRepository.cancelRemainingStages(requestId, approval.approval_level, client);

      // Update request to REJECTED
      await requestsRepository.updateStatus(
        requestId,
        "REJECTED",
        undefined,
        { rejection_reason: remarks.trim() },
        client
      );

      // Record history
      await requestsRepository.addHistory({
        requestId,
        companyId: approval.company_id,
        action: "REQUEST_REJECTED",
        fromStatus: approval.request_status,
        toStatus: "REJECTED",
        performedBy: actor.id,
        remarks: remarks.trim(),
      }, client);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_REJECTED', 'asset_requests', $3, $4::jsonb);
      `, [
        approval.company_id,
        actor.id,
        requestId,
        JSON.stringify({ requestNumber: approval.request_number, reason: remarks.trim() })
      ]);

      // Notify requester
      if (approval.requester_id) {
        await notificationService.create({
          userId: approval.requester_id,
          companyId: approval.company_id,
          notificationType: "REQUISITION_REJECTED",
          title: `Requisition Rejected: ${approval.request_number}`,
          message: `Your requisition was rejected by ${actor.username}: ${remarks.trim()}`,
          severity: "CRITICAL",
          type: "ALERT",
          entityType: "asset_requests",
          entityId: requestId,
          actionUrl: `/requests/${requestId}`,
          idempotencyKey: `REQ_REJECTED:${requestId}`
        }, client);
      }

      const updated = await approvalsRepository.findByIdWithLock(approvalId, client);
      return updated!;
    });
  }

  async returnForCorrection(
    requestId: string,
    approvalId: string,
    remarks: string,
    actor: AuthUser
  ): Promise<ApprovalWithDetails> {
    if (!remarks || !remarks.trim()) {
      throw new ValidationError("Correction instructions are required when returning a requisition");
    }

    return await withTransaction(async (client) => {
      const approval = await approvalsRepository.findByIdWithLock(approvalId, client);
      if (!approval) {
        throw new NotFoundError(`Approval step '${approvalId}' not found`);
      }
      if (approval.request_id !== requestId) {
        throw new BadRequestError("Approval step does not belong to the specified requisition");
      }

      assertCompanyAccess(actor, approval.company_id);

      if (approval.status !== "PENDING") {
        throw new ConflictError(`Approval step is already decided with status '${approval.status}'`);
      }

      if (!actor.isCommonAdmin) {
        const isAuthorizedRole = 
          actor.roleCode === approval.approver_role || 
          actor.roleCode === "COMPANY_ADMIN";

        if (!isAuthorizedRole) {
          throw new ForbiddenError(`Unauthorized approver: Role '${actor.roleCode}' cannot return this stage`);
        }
      }

      // Mark step returned
      await approvalsRepository.updateDecision(approvalId, {
        status: "CANCELLED",
        decision: "RETURNED_FOR_CORRECTION",
        approverId: actor.id,
        remarks: remarks.trim(),
      }, client);

      // Reset request status to DRAFT so user can edit and resubmit
      await requestsRepository.updateStatus(
        requestId,
        "DRAFT",
        1,
        { remarks: `Returned for correction: ${remarks.trim()}` },
        client
      );

      // Clean up previous approval stages so they are re-created fresh on re-submission
      await client.query(`DELETE FROM asset_request_approvals WHERE request_id = $1;`, [requestId]);

      // Record history
      await requestsRepository.addHistory({
        requestId,
        companyId: approval.company_id,
        action: "REQUEST_RETURNED",
        fromStatus: approval.request_status,
        toStatus: "DRAFT",
        performedBy: actor.id,
        remarks: remarks.trim(),
      }, client);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'REQUEST_RETURNED', 'asset_requests', $3, $4::jsonb);
      `, [
        approval.company_id,
        actor.id,
        requestId,
        JSON.stringify({ requestNumber: approval.request_number, instructions: remarks.trim() })
      ]);

      // Notify requester
      if (approval.requester_id) {
        await notificationService.create({
          userId: approval.requester_id,
          companyId: approval.company_id,
          notificationType: "REQUISITION_REJECTED",
          title: `Requisition Returned for Revision: ${approval.request_number}`,
          message: `Your requisition was returned by ${actor.username}: ${remarks.trim()}. Please make revisions and resubmit.`,
          severity: "WARNING",
          type: "WARNING",
          entityType: "asset_requests",
          entityId: requestId,
          actionUrl: `/requests/${requestId}`,
          idempotencyKey: `REQ_RETURNED:${requestId}`
        }, client);
      }

      return approval;
    });
  }

  async getRequestApprovals(requestId: string, actor: AuthUser): Promise<ApprovalWithDetails[]> {
    const request = await requestsRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError(`Requisition '${requestId}' not found`);
    }

    assertCompanyAccess(actor, request.company_id);
    return await approvalsRepository.findByRequestId(requestId);
  }

  async getPendingApprovals(actor: AuthUser): Promise<ApprovalWithDetails[]> {
    if (actor.isCommonAdmin) {
      return await approvalsRepository.findPendingForRole(null, undefined, null);
    }

    if (actor.roleCode === "COMPANY_ADMIN") {
      return await approvalsRepository.findPendingForRole(actor.companyId, undefined, null);
    }

    if (actor.roleCode === "DEPT_MANAGER") {
      return await approvalsRepository.findPendingForRole(
        actor.companyId,
        "DEPT_MANAGER",
        actor.departmentId || null
      );
    }

    if (actor.roleCode === "ASSET_MANAGER") {
      return await approvalsRepository.findPendingForRole(actor.companyId, "ASSET_MANAGER", null);
    }

    return [];
  }
}

export const approvalsService = new ApprovalsService();
