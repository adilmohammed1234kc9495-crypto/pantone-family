import { Request, Response, NextFunction } from "express";
import { assetsService } from "./assets.service";
import { FindAssetsOptions } from "./assets.repository";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response";

export class AssetsController {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const companyId = (req.query.companyId as string) || (req.tenant?.companyId ?? undefined);
      const branchId = req.query.branchId as string;
      const departmentId = req.query.departmentId as string;
      const locationId = req.query.locationId as string;
      const categoryId = req.query.categoryId as string;
      const vendorId = req.query.vendorId as string;
      const status = req.query.status as string;
      const condition = req.query.condition as string;
      const sortBy = req.query.sortBy as FindAssetsOptions["sortBy"];
      const sortOrder = req.query.sortOrder as FindAssetsOptions["sortOrder"];

      const result = await assetsService.getAssets(req.user!, {
        page,
        limit,
        search,
        companyId,
        branchId,
        departmentId,
        locationId,
        categoryId,
        vendorId,
        status,
        condition,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.assets, result.total, page, limit, "Assets retrieved successfully", "assets");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await assetsService.getAssetById(req.params.id, req.user!);
      sendSuccess(res, asset, "Asset retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await assetsService.createAsset(req.body, req.user!);
      sendCreated(res, asset, "Asset registered successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await assetsService.updateAsset(req.params.id, req.body, req.user!);
      sendSuccess(res, asset, "Asset updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async getDepreciation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dep = await assetsService.getAssetDepreciation(req.params.id, req.user!);
      sendSuccess(res, dep, "Asset depreciation schedule calculated successfully");
    } catch (error) {
      next(error);
    }
  }

  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await assetsService.getDocuments(req.params.id, req.user!);
      sendSuccess(res, docs, "Asset documents retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async addDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await assetsService.addDocument(req.params.id, req.body, req.user!);
      sendCreated(res, doc, "Asset document attached successfully");
    } catch (error) {
      next(error);
    }
  }

  async listPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const photos = await assetsService.getPhotos(req.params.id, req.user!);
      sendSuccess(res, photos, "Asset photos retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async addPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const photo = await assetsService.addPhoto(req.params.id, req.body, req.user!);
      sendCreated(res, photo, "Asset photo attached successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const assetsController = new AssetsController();
