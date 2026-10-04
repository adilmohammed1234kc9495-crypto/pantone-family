import { Request, Response, NextFunction } from "express";
import { categoriesService } from "./categories.service";
import { FindCategoriesOptions } from "./categories.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class CategoriesController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.query.tree === "true") {
        const tree = await categoriesService.getCategoryTree(req.user!, req.query.companyId as string);
        sendSuccess(res, tree, "Category hierarchy tree retrieved successfully");
        return;
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      const parentId = req.query.parentId !== undefined ? (req.query.parentId === "null" ? null : req.query.parentId as string) : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const sortBy = req.query.sortBy as FindCategoriesOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindCategoriesOptions["sortOrder"];

      const result = await categoriesService.getCategories(req.user!, {
        page,
        limit,
        search,
        companyId,
        parentId,
        isActive,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.categories, result.total, page, limit, "Categories retrieved successfully", "categories");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.getCategoryById(req.params.id, req.user!);
      sendSuccess(res, category, "Category retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.createCategory(req.body, req.user!);
      sendCreated(res, category, "Category created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.updateCategory(req.params.id, req.body, req.user!);
      sendSuccess(res, category, "Category updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.updateStatus(req.params.id, req.body.isActive, req.user!);
      sendSuccess(res, category, `Category ${req.body.isActive ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const categoriesController = new CategoriesController();
