import { Request, Response, NextFunction } from "express";
import { approvalWorkflowsService } from "./approval-workflows.service";
import { sendSuccess } from "../../utils/response";

export class ApprovalWorkflowsController {
  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await approvalWorkflowsService.createWorkflow(req.body, req.user!);
      sendSuccess(res, workflow, "Approval workflow configured successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async listWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = (req.query.companyId as string) || (req.tenant?.companyId || undefined);
      const workflows = await approvalWorkflowsService.listWorkflows(companyId, req.user!);
      sendSuccess(res, workflows, "Approval workflows retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getWorkflowById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await approvalWorkflowsService.getWorkflowById(req.params.id, req.user!);
      sendSuccess(res, workflow, "Approval workflow retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflow = await approvalWorkflowsService.updateWorkflow(req.params.id, req.body, req.user!);
      sendSuccess(res, workflow, "Approval workflow updated successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const approvalWorkflowsController = new ApprovalWorkflowsController();
