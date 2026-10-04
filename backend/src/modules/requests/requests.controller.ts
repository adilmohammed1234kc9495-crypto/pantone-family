import { Request, Response, NextFunction } from "express";
import { requestsService } from "./requests.service";
import { sendSuccess } from "../../utils/response";

export class RequestsController {
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.createRequest(req.body, req.user!);
      sendSuccess(res, request, "Asset requisition created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async updateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.updateRequest(req.params.id, req.body, req.user!);
      sendSuccess(res, request, "Asset requisition updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async submitRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.submitRequest(req.params.id, req.user!);
      sendSuccess(res, request, "Asset requisition submitted for approval");
    } catch (error) {
      next(error);
    }
  }

  async cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.cancelRequest(req.params.id, req.user!);
      sendSuccess(res, request, "Asset requisition cancelled");
    } catch (error) {
      next(error);
    }
  }

  async fulfillRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.fulfillRequest(req.params.id, req.body, req.user!);
      sendSuccess(res, request, "Asset requisition fulfilled successfully");
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestsService.getRequestById(req.params.id, req.user!);
      sendSuccess(res, request, "Asset requisition retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await requestsService.listRequests({
        companyId: (req.query.companyId as string) || (req.tenant?.companyId || undefined),
        status: req.query.status as string,
        priority: req.query.priority as string,
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        requesterId: req.query.requesterId as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page,
        limit,
      }, req.user!);

      sendSuccess(res, result, "Asset requisitions retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getRequestHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await requestsService.getRequestHistory(req.params.id, req.user!);
      sendSuccess(res, history, "Requisition history ledger retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const requestsController = new RequestsController();
