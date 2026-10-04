import { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service";
import { sendSuccess } from "../../utils/response";

export class AuditController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { companyId, action, entity, category, severity, status, startDate, endDate, search, page, limit } = req.query;

      let companyIdFilter: string | null | undefined;

      if (user.isCommonAdmin) {
        if (companyId !== undefined) {
          companyIdFilter = companyId === "null" || companyId === "" ? null : (companyId as string);
        }
      } else {
        companyIdFilter = user.companyId;
      }

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 20;

      const result = await auditService.getAuditLogs({
        companyId: companyIdFilter,
        action: action as string | undefined,
        entity: entity as string | undefined,
        category: category as string | undefined,
        severity: severity as string | undefined,
        status: status as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        search: search as string | undefined,
        page: isNaN(pageNum) ? 1 : pageNum,
        limit: isNaN(limitNum) ? 20 : limitNum
      }, user);

      sendSuccess(res, result, "Audit logs retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
