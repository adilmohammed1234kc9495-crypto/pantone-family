import {
  assetsRepository,
  AssetRow,
  AssetWithDetails,
  FindAssetsOptions,
  DocumentRow,
  PhotoRow
} from "./assets.repository";
import { depreciationService, DepreciationCalculationResult, DepreciationScheduleItem } from "./depreciation.service";
import { categoriesRepository } from "../categories/categories.repository";
import { branchesRepository } from "../branches/branches.repository";
import { departmentsRepository } from "../departments/departments.repository";
import { locationsRepository } from "../locations/locations.repository";
import { vendorsRepository } from "../vendors/vendors.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError } from "../../utils/errors";
import { query } from "../../config/database";
import crypto from "crypto";
import path from "path";

export interface CreateAssetInput {
  companyId?: string;
  branchId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  categoryId: string;
  vendorId?: string | null;
  assetTag?: string;
  barcode?: string;
  qrCode?: string;
  name: string;
  subcategory?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  modelNumber?: string | null;
  manufacturer?: string | null;
  purchaseDate?: string | null;
  purchaseCost: number;
  invoiceNumber?: string | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  status?: string;
  condition?: string;
  photoUrl?: string | null;
  notes?: string | null;
  depreciationMethod?: string | null;
  depreciationRatePercent?: number | null;
  usefulLifeMonths?: number | null;
  depreciationStartDate?: string | null;
}

export interface UpdateAssetInput {
  name?: string;
  branchId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  vendorId?: string | null;
  serialNumber?: string | null;
  modelNumber?: string | null;
  manufacturer?: string | null;
  condition?: string;
  notes?: string | null;
  description?: string | null;
  current_value?: number;
  depreciationMethod?: string;
  depreciationRatePercent?: number;
  usefulLifeMonths?: number;
}

export class AssetsService {
  async getAssets(user: AuthUser, options: FindAssetsOptions = {}): Promise<{ assets: AssetWithDetails[]; total: number }> {
    return assetsRepository.findWithFilters(user, options);
  }

  async getAssetById(id: string, user: AuthUser): Promise<AssetWithDetails> {
    const asset = await assetsRepository.findByIdDetailed(id, user);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${id}' not found`);
    }
    return asset;
  }

  async createAsset(data: CreateAssetInput, user: AuthUser): Promise<AssetRow> {
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ConflictError("Company ID is required to register an asset");
    }
    assertCompanyAccess(user, targetCompanyId);

    // 1. Validate Category
    const category = await categoriesRepository.findById(data.categoryId);
    if (!category) {
      throw new NotFoundError(`Asset Category '${data.categoryId}' not found`);
    }
    if (category.company_id && category.company_id !== targetCompanyId) {
      throw new ValidationError("Category belongs to another company");
    }

    // 2. Validate Branch
    if (data.branchId) {
      const branch = await branchesRepository.findById(data.branchId);
      if (!branch) {
        throw new NotFoundError(`Branch '${data.branchId}' not found`);
      }
      if (branch.company_id !== targetCompanyId) {
        throw new ValidationError("Branch does not belong to the selected company");
      }
    }

    // 3. Validate Department
    if (data.departmentId) {
      const dept = await departmentsRepository.findById(data.departmentId);
      if (!dept) {
        throw new NotFoundError(`Department '${data.departmentId}' not found`);
      }
      if (dept.company_id !== targetCompanyId) {
        throw new ValidationError("Department does not belong to the selected company");
      }
    }

    // 4. Validate Location
    if (data.locationId) {
      const loc = await locationsRepository.findById(data.locationId);
      if (!loc) {
        throw new NotFoundError(`Location '${data.locationId}' not found`);
      }
      if (loc.company_id !== targetCompanyId) {
        throw new ValidationError("Location does not belong to the selected company");
      }
    }

    // 5. Validate Vendor
    if (data.vendorId) {
      const vendor = await vendorsRepository.findById(data.vendorId);
      if (!vendor) {
        throw new NotFoundError(`Vendor '${data.vendorId}' not found`);
      }
      if (vendor.company_id !== targetCompanyId) {
        throw new ValidationError("Vendor does not belong to the selected company");
      }
    }

    // 6. Depreciation Parameters (Inherited from Category if omitted)
    const depMethod = data.depreciationMethod || category.depreciation_method || "STRAIGHT_LINE";
    const depUsefulLife = data.usefulLifeMonths !== undefined && data.usefulLifeMonths !== null
      ? data.usefulLifeMonths
      : category.useful_life_months || 60;
    const depRate = data.depreciationRatePercent !== undefined && data.depreciationRatePercent !== null
      ? data.depreciationRatePercent
      : category.depreciation_rate_percent || 10.00;
    const depStartDate = data.depreciationStartDate || data.purchaseDate || new Date().toISOString().split("T")[0];

    // Compute initial depreciation
    const depCalc = depreciationService.calculate({
      purchaseCost: data.purchaseCost,
      usefulLifeMonths: depUsefulLife,
      depreciationMethod: depMethod,
      depreciationStartDate: depStartDate,
      asOfDate: new Date(),
    });

    // 7. Asset Identifiers (Asset Tag, Barcode, QR Code)
    let assetTag = data.assetTag?.trim();
    if (!assetTag) {
      const yr = new Date().getFullYear();
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      assetTag = `AST-${targetCompanyId.substring(0, 4).toUpperCase()}-${yr}-${rand}`;
    }

    const existingTag = await assetsRepository.findByTag(assetTag);
    if (existingTag) {
      throw new ConflictError(`Asset Tag '${assetTag}' already exists`);
    }

    const barcode = data.barcode?.trim() || `BAR-${assetTag}`;
    const qrCode = data.qrCode?.trim() || `QR-${assetTag}`;

    const created = await assetsRepository.create({
      companyId: targetCompanyId,
      branchId: data.branchId || null,
      departmentId: data.departmentId || null,
      locationId: data.locationId || null,
      categoryId: data.categoryId,
      vendorId: data.vendorId || null,
      assetTag,
      barcode,
      qrCode,
      name: data.name.trim(),
      subcategory: data.subcategory || null,
      description: data.description || null,
      serialNumber: data.serialNumber || null,
      modelNumber: data.modelNumber || null,
      manufacturer: data.manufacturer || null,
      purchaseDate: data.purchaseDate || null,
      purchaseCost: data.purchaseCost,
      currentValue: depCalc.bookValue,
      invoiceNumber: data.invoiceNumber || null,
      warrantyStart: data.warrantyStart || null,
      warrantyEnd: data.warrantyEnd || null,
      status: data.status || "AVAILABLE",
      condition: data.condition || "NEW",
      photoUrl: data.photoUrl || null,
      notes: data.notes || null,
      depreciationMethod: depMethod,
      depreciationRatePercent: depRate,
      usefulLifeMonths: depUsefulLife,
      depreciationStartDate: depStartDate,
      accumulatedDepreciation: depCalc.accumulatedDepreciation,
      createdBy: user.id,
    }, user);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'ASSET_CREATE', 'assets', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateAsset(id: string, data: UpdateAssetInput, user: AuthUser): Promise<AssetRow> {
    const existing = await assetsRepository.findById(id, user);
    if (!existing) {
      throw new NotFoundError(`Asset with ID '${id}' not found`);
    }
    assertCompanyAccess(user, existing.company_id);

    // If branch, department, location, or vendor changed, validate company matching
    if (data.branchId) {
      const b = await branchesRepository.findById(data.branchId);
      if (!b || b.company_id !== existing.company_id) {
        throw new ValidationError("Branch does not belong to asset company");
      }
    }
    if (data.departmentId) {
      const d = await departmentsRepository.findById(data.departmentId);
      if (!d || d.company_id !== existing.company_id) {
        throw new ValidationError("Department does not belong to asset company");
      }
    }
    if (data.locationId) {
      const l = await locationsRepository.findById(data.locationId);
      if (!l || l.company_id !== existing.company_id) {
        throw new ValidationError("Location does not belong to asset company");
      }
    }
    if (data.vendorId) {
      const v = await vendorsRepository.findById(data.vendorId);
      if (!v || v.company_id !== existing.company_id) {
        throw new ValidationError("Vendor does not belong to asset company");
      }
    }

    const updated = await assetsRepository.update(id, data, user);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'ASSET_UPDATE', 'assets', $3, $4::jsonb, $5::jsonb)
    `, [existing.company_id, user.id, id, JSON.stringify(existing), JSON.stringify(updated)]);

    return updated;
  }

  async getAssetDepreciation(id: string, user: AuthUser): Promise<{
    calculation: DepreciationCalculationResult;
    schedule: DepreciationScheduleItem[];
  }> {
    const asset = await this.getAssetById(id, user);

    const cost = Number(asset.purchase_cost);
    const usefulLife = asset.useful_life_months || 60;
    const method = asset.depreciation_method || "STRAIGHT_LINE";
    const startDate = asset.depreciation_start_date || asset.purchase_date || asset.created_at;

    const calculation = depreciationService.calculate({
      purchaseCost: cost,
      usefulLifeMonths: usefulLife,
      depreciationMethod: method,
      depreciationStartDate: startDate,
      asOfDate: new Date(),
    });

    const schedule = depreciationService.generateSchedule({
      purchaseCost: cost,
      usefulLifeMonths: usefulLife,
      depreciationMethod: method,
      depreciationStartDate: startDate,
    });

    return { calculation, schedule };
  }

  // --- Document Management ---
  async getDocuments(assetId: string, user: AuthUser): Promise<DocumentRow[]> {
    await this.getAssetById(assetId, user);
    return assetsRepository.findDocumentsByAssetId(assetId);
  }

  async addDocument(assetId: string, data: {
    title: string;
    documentType: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }, user: AuthUser): Promise<DocumentRow> {
    const asset = await this.getAssetById(assetId, user);

    // Safe path normalization (prevents path traversal)
    const sanitizedFileName = path.basename(data.filePath);
    if (!sanitizedFileName || data.filePath.includes("..")) {
      throw new ValidationError("Invalid file path specified");
    }

    if (data.fileSize <= 0 || data.fileSize > 25 * 1024 * 1024) {
      throw new ValidationError("File size must be between 1 byte and 25MB");
    }

    const doc = await assetsRepository.createDocument({
      assetId,
      title: data.title.trim(),
      documentType: data.documentType,
      filePath: `/storage/documents/${asset.company_id}/${assetId}/${sanitizedFileName}`,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: user.id,
    });

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'ASSET_DOCUMENT_UPLOAD', 'asset_documents', $3, $4::jsonb)
    `, [asset.company_id, user.id, doc.id, JSON.stringify(doc)]);

    return doc;
  }

  // --- Photo Management ---
  async getPhotos(assetId: string, user: AuthUser): Promise<PhotoRow[]> {
    await this.getAssetById(assetId, user);
    return assetsRepository.findPhotosByAssetId(assetId);
  }

  async addPhoto(assetId: string, data: {
    photoType: string;
    filePath: string;
    caption?: string | null;
    isPrimary?: boolean;
  }, user: AuthUser): Promise<PhotoRow> {
    const asset = await this.getAssetById(assetId, user);

    const sanitizedFileName = path.basename(data.filePath);
    if (!sanitizedFileName || data.filePath.includes("..")) {
      throw new ValidationError("Invalid file path specified");
    }

    const safeStoragePath = `/storage/photos/${asset.company_id}/${assetId}/${sanitizedFileName}`;

    const photo = await assetsRepository.createPhoto({
      assetId,
      photoType: data.photoType,
      filePath: safeStoragePath,
      caption: data.caption || null,
      uploadedBy: user.id,
    });

    // If primary or first photo, update photo_url on asset
    if (data.isPrimary || !asset.photo_url) {
      await query("UPDATE assets SET photo_url = $1 WHERE id = $2", [safeStoragePath, assetId]);
    }

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'ASSET_PHOTO_UPLOAD', 'asset_photos', $3, $4::jsonb)
    `, [asset.company_id, user.id, photo.id, JSON.stringify(photo)]);

    return photo;
  }
}

export const assetsService = new AssetsService();
