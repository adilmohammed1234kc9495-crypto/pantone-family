import { Request, Response, NextFunction } from "express";
import { assignmentsService } from "./assignments.service";
import { sendSuccess } from "../../utils/response";

export class AssignmentsController {
  async assignAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignment = await assignmentsService.assignAsset(req.body, req.user!);
      sendSuccess(res, assignment, "Asset successfully assigned to employee", 201);
    } catch (error) {
      next(error);
    }
  }

  async confirmHandover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignment = await assignmentsService.confirmHandover(req.params.id, req.body, req.user!);
      sendSuccess(res, assignment, "Asset physical handover confirmed successfully");
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignment = await assignmentsService.getAssignmentById(req.params.id, req.user!);
      sendSuccess(res, assignment, "Assignment retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const isHandedOver = req.query.isHandedOver !== undefined 
        ? req.query.isHandedOver === "true" 
        : undefined;

      const result = await assignmentsService.listAssignments({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        assetId: req.query.assetId as string,
        employeeId: req.query.employeeId as string,
        departmentId: req.query.departmentId as string,
        status: req.query.status as string,
        isHandedOver,
        page,
        limit
      }, req.user!);

      sendSuccess(res, result, "Assignments retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentsController = new AssignmentsController();