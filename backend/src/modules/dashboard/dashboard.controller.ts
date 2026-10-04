import { Request, Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { sendSuccess } from "../../utils/response";

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const tenant = req.tenant;

      // If tenant context has a companyId (either company user or Common Admin with X-Company-Id), use it
      const explicitCompanyId = tenant?.companyId || null;

      const stats = await dashboardService.getStats(user, explicitCompanyId);
      sendSuccess(res, stats, "Dashboard statistics retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
