import { Request, Response, NextFunction } from "express";
import { approvalsService } from "./approvals.service";
import { sendSuccess } from "../../utils/response";

export class ApprovalsController {
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.approve(
        req.params.id,
        req.params.approvalId,
        req.body.remarks,
        req.user!
      );
      sendSuccess(res, result, "Requisition approval stage recorded successfully");
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.reject(
        req.params.id,
        req.params.approvalId,
        req.body.remarks,
        req.user!
      );
      sendSuccess(res, result, "Requisition rejected");
    } catch (error) {
      next(error);
    }
  }

  async returnForCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.returnForCorrection(
        req.params.id,
        req.params.approvalId,
        req.body.remarks,
        req.user!
      );
      sendSuccess(res, result, "Requisition returned to requester for revision");
    } catch (error) {
      next(error);
    }
  }

  async getRequestApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approvals = await approvalsService.getRequestApprovals(req.params.id, req.user!);
      sendSuccess(res, approvals, "Requisition approval stages retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pending = await approvalsService.getPendingApprovals(req.user!);
      sendSuccess(res, pending, "Pending approvals retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const approvalsController = new ApprovalsController();
