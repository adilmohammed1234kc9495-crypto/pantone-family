import { Request, Response, NextFunction } from "express";
import { reportsService, ReportResponse } from "./reports.service";
import { sendSuccess } from "../../utils/response";
import { ForbiddenError } from "../../utils/errors";

export class ReportsController {
  private handleResponse(req: Request, res: Response, result: ReportResponse, successMessage = "Report generated successfully"): void {
    if (result.type === "export") {
      const user = req.user;
      if (user && !user.isCommonAdmin && !user.permissions.includes("reports:export")) {
        throw new ForbiddenError("Insufficient permissions. Missing required: reports:export");
      }
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("Content-Type", result.contentType || "application/octet-stream");
      res.send(result.exportBuffer);
      return;
    }

    sendSuccess(res, {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      summary: result.summary,
    }, successMessage);
  }

  // 1. Executive Dashboard
  public getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await reportsService.getDashboard(req.tenant!, req.user!);
      sendSuccess(res, data, "Executive dashboard metrics retrieved successfully");
    } catch (err) {
      next(err);
    }
  };

  // 2. Asset Register Report
  public getAssetRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getAssetRegister(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Asset register report generated");
    } catch (err) {
      next(err);
    }
  };

  // 3. Depreciation Report
  public getDepreciation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getDepreciation(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Depreciation report generated");
    } catch (err) {
      next(err);
    }
  };

  // 4. Transfers Report
  public getTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getTransfers(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Asset transfers report generated");
    } catch (err) {
      next(err);
    }
  };

  // 5. Custody Report
  public getCustody = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getCustody(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Custody tracking report generated");
    } catch (err) {
      next(err);
    }
  };

  // 6. Maintenance Report
  public getMaintenance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getMaintenance(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Maintenance analytics report generated");
    } catch (err) {
      next(err);
    }
  };

  // 7. Stock Report
  public getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getStock(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Stock inventory report generated");
    } catch (err) {
      next(err);
    }
  };

  // 8. Requests Report
  public getRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getRequests(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Asset requisitions report generated");
    } catch (err) {
      next(err);
    }
  };

  // 9. Audit Report
  public getAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getAudit(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Audit compliance report generated");
    } catch (err) {
      next(err);
    }
  };

  // 10. Scans Report
  public getScans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = { ...req.query };
      const result = await reportsService.getScans(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result, "Physical scan event report generated");
    } catch (err) {
      next(err);
    }
  };

  // Dedicated export endpoint wrappers that force format=csv or format=xlsx if not specified
  public exportAssetRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getAssetRegister(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportDepreciation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getDepreciation(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getTransfers(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportCustody = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getCustody(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportMaintenance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getMaintenance(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getStock(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getRequests(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getAudit(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  public exportScans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || "csv";
      const filters = { ...req.query, format };
      const result = await reportsService.getScans(filters, req.tenant!, req.user!);
      this.handleResponse(req, res, result);
    } catch (err) {
      next(err);
    }
  };
}

export const reportsController = new ReportsController();
