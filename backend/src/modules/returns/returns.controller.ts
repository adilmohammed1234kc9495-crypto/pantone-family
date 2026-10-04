import { Request, Response, NextFunction } from "express";
import { returnsService } from "./returns.service";
import { sendSuccess } from "../../utils/response";

export class ReturnsController {
  async initiateReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await returnsService.initiateReturn(req.body, req.user!);
      sendSuccess(res, result, "Asset return initiated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async inspectReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await returnsService.inspectReturn(req.params.id, req.body, req.user!);
      sendSuccess(res, result, "Return inspection processed successfully");
    } catch (error) {
      next(error);
    }
  }

  async getReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await returnsService.getReturnById(req.params.id, req.user!);
      sendSuccess(res, result, "Return record retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await returnsService.listReturns({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        assetId: req.query.assetId as string,
        returnedBy: req.query.returnedBy as string,
        inspectionStatus: req.query.inspectionStatus as string,
        page,
        limit
      }, req.user!);

      sendSuccess(res, result, "Returns retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const returnsController = new ReturnsController();