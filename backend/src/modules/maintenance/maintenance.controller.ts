import { Request, Response, NextFunction } from "express";
import { maintenanceService } from "./maintenance.service";
import { sendSuccess } from "../../utils/response";

export class MaintenanceController {
  async createWorkOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await maintenanceService.createWorkOrder(req.body, req.user!);
      sendSuccess(res, result, "Maintenance work order created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async transitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await maintenanceService.transitionStatus(req.params.id, req.body, req.user!);
      sendSuccess(res, result, "Work order status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async recordCosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await maintenanceService.recordCosts(req.params.id, req.body, req.user!);
      sendSuccess(res, result, "Maintenance costs updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async getWorkOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await maintenanceService.getWorkOrderById(req.params.id, req.user!);
      sendSuccess(res, result, "Maintenance work order retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listWorkOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await maintenanceService.listWorkOrders({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        assetId: req.query.assetId as string,
        status: req.query.status as string,
        priority: req.query.priority as string,
        maintenanceType: req.query.maintenanceType as string,
        vendorId: req.query.vendorId as string,
        page,
        limit
      }, req.user!);

      sendSuccess(res, result, "Maintenance work orders retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const maintenanceController = new MaintenanceController();