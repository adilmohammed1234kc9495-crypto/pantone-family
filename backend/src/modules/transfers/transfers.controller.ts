import { Request, Response, NextFunction } from "express";
import { transfersService } from "./transfers.service";
import { sendSuccess } from "../../utils/response";

export class TransfersController {
  async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.initiateTransfer(req.body, req.user!);
      sendSuccess(res, result, "Asset transfer initiated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.approveTransfer(req.params.id, req.body.remarks, req.user!);
      sendSuccess(res, result, "Transfer approved successfully");
    } catch (error) {
      next(error);
    }
  }

  async dispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.dispatchTransfer(req.params.id, req.user!);
      sendSuccess(res, result, "Transfer dispatched successfully. Asset is now in transit.");
    } catch (error) {
      next(error);
    }
  }

  async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.confirmReceipt(req.params.id, req.body, req.user!);
      sendSuccess(res, result, "Transfer confirmed and asset successfully accepted at destination");
    } catch (error) {
      next(error);
    }
  }

  async dispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.disputeTransfer(req.params.id, req.body.reason, req.user!);
      sendSuccess(res, result, "Transfer marked as disputed");
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.cancelTransfer(req.params.id, req.body.reason, req.user!);
      sendSuccess(res, result, "Transfer cancelled successfully");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transfersService.getTransferById(req.params.id, req.user!);
      sendSuccess(res, result, "Transfer details retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await transfersService.listTransfers({
        companyId: req.query.companyId as string,
        assetId: req.query.assetId as string,
        status: req.query.status as string,
        transferType: req.query.transferType as string,
        search: req.query.search as string,
        page,
        limit,
      }, req.user!);

      sendSuccess(res, result, "Asset transfers retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const transfersController = new TransfersController();
