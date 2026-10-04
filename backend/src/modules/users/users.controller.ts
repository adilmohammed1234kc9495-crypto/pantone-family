import { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service";
import { FindUsersOptions } from "./users.repository";
import { sendSuccess, sendCreated } from "../../utils/response";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { search, roleId, status, page, limit } = req.query;

      let companyIdFilter: string | null | undefined;

      if (user.isCommonAdmin) {
        // Common Admin can filter by companyId or see global
        if (req.query.companyId !== undefined) {
          companyIdFilter = req.query.companyId === "null" || req.query.companyId === "" ? null : (req.query.companyId as string);
        }
      } else {
        // Company user strictly locked to their company
        companyIdFilter = user.companyId;
      }

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      const result = await usersService.getUsers({
        companyId: companyIdFilter,
        roleId: roleId as string | undefined,
        status: status as FindUsersOptions["status"],
        search: search as string | undefined,
        page: isNaN(pageNum) ? 1 : pageNum,
        limit: isNaN(limitNum) ? 10 : limitNum
      });

      sendSuccess(res, result, "Users retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userItem = await usersService.getUserById(id);

      if (userItem.company_id) {
        assertCompanyAccess(req.user!, userItem.company_id, req);
      }

      sendSuccess(res, userItem, "User details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const created = await usersService.createUser(req.body, user);
      sendCreated(res, created, "User created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const updated = await usersService.updateUser(id, req.body, user);
      sendSuccess(res, updated, "User updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const user = req.user!;
      const updated = await usersService.setUserStatus(id, isActive, user);
      sendSuccess(res, updated, `User status updated to ${isActive ? "active" : "inactive"}`);
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
