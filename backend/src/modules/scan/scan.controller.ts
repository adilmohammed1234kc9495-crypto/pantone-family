import { Request, Response, NextFunction } from "express";
import { scanService } from "./scan.service";
import { sendSuccess } from "../../utils/response";

export class ScanController {
  /**
   * GET /api/v1/scan/assets/:token
   */
  async resolveByToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const scanType = (req.query.scanType as "QR" | "BARCODE" | "MANUAL") || "QR";
      const source = (req.query.source as "WEB_CAMERA" | "MANUAL_ENTRY" | "HARDWARE_SCANNER") || "WEB_CAMERA";

      const result = await scanService.resolveToken(token, req.user!, scanType, source, req.tenant);
      sendSuccess(res, result, "Asset scanned and resolved successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/scan/resolve
   */
  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, scanType = "QR", source = "WEB_CAMERA" } = req.body;
      const result = await scanService.resolveToken(code, req.user!, scanType, source, req.tenant);
      sendSuccess(res, result, "Asset scanned and resolved successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assets/:id/qr
   */
  async getAssetQr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scanService.getAssetQr(id, req.user!);
      sendSuccess(res, result, "Asset QR code generated successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/assets/:id/qr/regenerate
   */
  async regenerateQr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scanService.regenerateQr(id, req.user!);
      sendSuccess(res, result, "Asset QR code regenerated successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assets/:id/barcode
   */
  async getAssetBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scanService.getAssetBarcode(id, req.user!);
      sendSuccess(res, result, "Asset Code 128 barcode generated successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/assets/:id/labels/print
   */
  async printLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scanService.printLabel(id, req.user!);
      sendSuccess(res, result, "Asset printable label generated successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/assets/labels/batch
   */
  async getBatchLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assetIds } = req.body;
      const result = await scanService.getBatchLabels(assetIds, req.user!);
      sendSuccess(res, result, "Batch asset labels generated successfully");
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assets/:id/scans
   */
  async listAssetScans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await scanService.listAssetScans(id, req.user!);
      sendSuccess(res, result, "Asset physical scan history retrieved");
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/scans
   */
  async listScans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scanType, source, isSuccess, page, limit } = req.query;
      const result = await scanService.listScans(req.user!, {
        scanType: scanType as string,
        source: source as string,
        isSuccess: isSuccess !== undefined ? isSuccess === "true" : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });
      sendSuccess(res, result.scans, "Scan event history retrieved", 200, {
        total: result.total,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
    } catch (err) {
      next(err);
    }
  }
}

export const scanController = new ScanController();
