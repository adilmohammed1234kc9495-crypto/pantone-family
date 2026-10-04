import { Request, Response, NextFunction } from "express";
import { damageInspectionsService } from "./damage-inspections.service";
import { sendSuccess } from "../../utils/response";

export class DamageInspectionsController {
  async recordInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await damageInspectionsService.recordInspection(req.body, req.user!);
      sendSuccess(res, result, "Damage inspection recorded successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async resolveDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await damageInspectionsService.resolveDecision(req.params.id, req.body, req.user!);
      sendSuccess(res, result, "Damage inspection decision resolved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getInspectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await damageInspectionsService.getInspectionById(req.params.id, req.user!);
      sendSuccess(res, result, "Damage inspection retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listInspections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await damageInspectionsService.listInspections({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        assetId: req.query.assetId as string,
        severity: req.query.severity as string,
        status: req.query.status as string,
        page,
        limit
      }, req.user!);

      sendSuccess(res, result, "Damage inspections retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const damageInspectionsController = new DamageInspectionsController();