import { Request, Response, NextFunction } from "express";
import { departmentsService } from "./departments.service";
import { FindDepartmentsOptions } from "./departments.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class DepartmentsController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      const branchId = req.query.branchId as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const sortBy = req.query.sortBy as FindDepartmentsOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindDepartmentsOptions["sortOrder"];

      const result = await departmentsService.getDepartments(req.user!, {
        page,
        limit,
        search,
        companyId,
        branchId,
        isActive,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.departments, result.total, page, limit, "Departments retrieved successfully", "departments");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.getDepartmentById(req.params.id, req.user!);
      sendSuccess(res, department, "Department retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.createDepartment(req.body, req.user!);
      sendCreated(res, department, "Department created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.updateDepartment(req.params.id, req.body, req.user!);
      sendSuccess(res, department, "Department updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.updateStatus(req.params.id, req.body.isActive, req.user!);
      sendSuccess(res, department, `Department ${req.body.isActive ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const departmentsController = new DepartmentsController();
