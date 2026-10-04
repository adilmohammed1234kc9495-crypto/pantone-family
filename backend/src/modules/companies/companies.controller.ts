import { Request, Response, NextFunction } from "express";
import { companiesService } from "./companies.service";
import { FindCompaniesOptions } from "./companies.repository";
import { sendSuccess, sendCreated } from "../../utils/response";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";

export class CompaniesController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, status, page, limit, sortBy, sortOrder } = req.query;

      if (page !== undefined || limit !== undefined || search !== undefined || status !== undefined) {
        const pageNum = page ? parseInt(page as string, 10) : 1;
        const limitNum = limit ? parseInt(limit as string, 10) : 10;
        const result = await companiesService.getCompaniesWithStats({
          search: search as string | undefined,
          status: status as "all" | "active" | "inactive" | undefined,
          page: isNaN(pageNum) ? 1 : pageNum,
          limit: isNaN(limitNum) ? 10 : limitNum,
          sortBy: sortBy as FindCompaniesOptions["sortBy"],
          sortOrder: sortOrder as FindCompaniesOptions["sortOrder"]
        });

        sendSuccess(res, {
          companies: result.companies,
          total: result.total,
          page: isNaN(pageNum) ? 1 : pageNum,
          limit: isNaN(limitNum) ? 10 : limitNum,
          totalPages: Math.ceil(result.total / (isNaN(limitNum) ? 10 : limitNum))
        }, "Companies retrieved successfully");
        return;
      }

      // Backward compatible default: array of companies with stats
      const result = await companiesService.getCompaniesWithStats({ limit: 100 });
      sendSuccess(res, result.companies, "Companies retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      assertCompanyAccess(req.user!, id, req);
      const company = await companiesService.getCompanyDetailsWithStats(id);
      sendSuccess(res, company, "Company details retrieved");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companiesService.createCompany(req.body, req.user?.id);
      sendCreated(res, company, "Company created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await companiesService.updateCompany(id, req.body, req.user?.id);
      sendSuccess(res, company, "Company updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const company = await companiesService.setCompanyStatus(id, isActive, req.user?.id);
      sendSuccess(res, company, `Company status updated to ${isActive ? "active" : "inactive"}`);
    } catch (error) {
      next(error);
    }
  }

  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      assertCompanyAccess(req.user!, id, req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const activity = await companiesService.getCompanyActivity(id, isNaN(limit) ? 20 : limit);
      sendSuccess(res, activity, "Company activity retrieved");
    } catch (error) {
      next(error);
    }
  }
}

export const companiesController = new CompaniesController();