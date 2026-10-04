import { Request, Response, NextFunction } from "express";
import { locationsService } from "./locations.service";
import { FindLocationsOptions } from "./locations.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class LocationsController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      const branchId = req.query.branchId as string;
      const building = req.query.building as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const sortBy = req.query.sortBy as FindLocationsOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindLocationsOptions["sortOrder"];

      const result = await locationsService.getLocations(req.user!, {
        page,
        limit,
        search,
        companyId,
        branchId,
        building,
        isActive,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.locations, result.total, page, limit, "Locations retrieved successfully", "locations");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = await locationsService.getLocationById(req.params.id, req.user!);
      sendSuccess(res, location, "Location retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = await locationsService.createLocation(req.body, req.user!);
      sendCreated(res, location, "Location created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = await locationsService.updateLocation(req.params.id, req.body, req.user!);
      sendSuccess(res, location, "Location updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = await locationsService.updateStatus(req.params.id, req.body.isActive, req.user!);
      sendSuccess(res, location, `Location ${req.body.isActive ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const locationsController = new LocationsController();
