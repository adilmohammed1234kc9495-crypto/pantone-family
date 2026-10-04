import { Request, Response, NextFunction } from "express";
import { branchesService } from "./branches.service";
import { FindBranchesOptions } from "./branches.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class BranchesController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const sortBy = req.query.sortBy as FindBranchesOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindBranchesOptions["sortOrder"];

      const result = await branchesService.getBranches(req.user!, {
        page,
        limit,
        search,
        companyId,
        isActive,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.branches, result.total, page, limit, "Branches retrieved successfully", "branches");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.getBranchById(req.params.id, req.user!);
      sendSuccess(res, branch, "Branch retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.createBranch(req.body, req.user!);
      sendCreated(res, branch, "Branch created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.updateBranch(req.params.id, req.body, req.user!);
      sendSuccess(res, branch, "Branch updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.updateStatus(req.params.id, req.body.isActive, req.user!);
      sendSuccess(res, branch, `Branch ${req.body.isActive ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const branchesController = new BranchesController();
