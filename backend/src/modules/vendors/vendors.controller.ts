import { Request, Response, NextFunction } from "express";
import { vendorsService } from "./vendors.service";
import { FindVendorsOptions } from "./vendors.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class VendorsController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const sortBy = req.query.sortBy as FindVendorsOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindVendorsOptions["sortOrder"];

      const result = await vendorsService.getVendors(req.user!, {
        page,
        limit,
        search,
        companyId,
        isActive,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.vendors, result.total, page, limit, "Vendors retrieved successfully", "vendors");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await vendorsService.getVendorById(req.params.id, req.user!);
      sendSuccess(res, vendor, "Vendor retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await vendorsService.createVendor(req.body, req.user!);
      sendCreated(res, vendor, "Vendor created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await vendorsService.updateVendor(req.params.id, req.body, req.user!);
      sendSuccess(res, vendor, "Vendor updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await vendorsService.updateStatus(req.params.id, req.body.isActive, req.user!);
      sendSuccess(res, vendor, `Vendor ${req.body.isActive ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const vendorsController = new VendorsController();
