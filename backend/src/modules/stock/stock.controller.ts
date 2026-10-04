import { Request, Response, NextFunction } from "express";
import { stockService } from "./stock.service";
import { sendSuccess } from "../../utils/response";

export class StockController {
  async createStockItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await stockService.createStockItem(req.body, req.user!);
      sendSuccess(res, item, "Stock item created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getStockItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await stockService.getStockItemById(req.params.id, req.user!);
      sendSuccess(res, item, "Stock item retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listStockItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      const result = await stockService.listStockItems({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        search: req.query.search as string,
        categoryId: req.query.categoryId as string,
        locationId: req.query.locationId as string,
        status: req.query.status as string,
        isActive,
        page,
        limit
      }, req.user!);

      sendSuccess(res, result, "Stock items retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStockItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await stockService.updateStockItem(req.params.id, req.body, req.user!);
      sendSuccess(res, item, "Stock item updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStockStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.isActive === true;
      const item = await stockService.updateStockStatus(req.params.id, isActive, req.user!);
      sendSuccess(res, item, `Stock item status updated to ${isActive ? "active" : "inactive"}`);
    } catch (error) {
      next(error);
    }
  }

  async recordMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const movement = await stockService.recordMovement(req.params.id, req.body, req.user!);
      sendSuccess(res, movement, "Stock movement recorded successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await stockService.getMovements(req.params.id, { page, limit }, req.user!);
      sendSuccess(res, result, "Stock movements retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = (req.query.companyId as string) || (req.tenant?.companyId || undefined);
      const alerts = await stockService.getStockAlerts(companyId, req.user!);
      sendSuccess(res, alerts, "Stock alerts retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const stockController = new StockController();
