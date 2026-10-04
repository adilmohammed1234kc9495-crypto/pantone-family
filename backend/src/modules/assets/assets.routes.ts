import { Router } from "express";
import { z } from "zod";
import { assetsController } from "./assets.controller";
import { assetsRepository } from "./assets.repository";
import { assignmentsRepository } from "../assignments/assignments.repository";
import { returnsRepository } from "../returns/returns.repository";
import { damageInspectionsRepository } from "../damage-inspections/damage-inspections.repository";
import { maintenanceRepository } from "../maintenance/maintenance.repository";
import { transfersService } from "../transfers/transfers.service";
import { scanController } from "../scan/scan.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { sendSuccess } from "../../utils/response";

export const assetsRouter = Router();

assetsRouter.use(authenticate, resolveTenantContext);

const createAssetSchema = z.object({
  companyId: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  vendorId: z.string().uuid().nullable().optional(),
  assetTag: z.string().min(2).max(100).optional(),
  barcode: z.string().min(2).max(100).optional(),
  qrCode: z.string().min(2).max(100).optional(),
  name: z.string().min(2).max(255),
  subcategory: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseCost: z.number().min(0),
  invoiceNumber: z.string().nullable().optional(),
  warrantyStart: z.string().nullable().optional(),
  warrantyEnd: z.string().nullable().optional(),
  status: z.enum([
    "AVAILABLE", "IN_STOCK", "ASSIGNED", "UNDER_MAINTENANCE",
    "DAMAGED", "LOST", "RETURNED", "TRANSFERRED", "RETIRED", "DISPOSED"
  ]).optional(),
  condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]).optional(),
  photoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.number().min(0).max(100).optional(),
  usefulLifeMonths: z.number().int().min(1).optional(),
  depreciationStartDate: z.string().nullable().optional(),
});

const updateAssetSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]).optional(),
  notes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  current_value: z.number().min(0).optional(),
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.number().min(0).max(100).optional(),
  usefulLifeMonths: z.number().int().min(1).optional(),
});

const addDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  documentType: z.string().min(1).max(50),
  filePath: z.string().min(1),
  fileSize: z.number().int().min(1),
  mimeType: z.string().min(1),
});

const addPhotoSchema = z.object({
  photoType: z.string().min(1).max(50),
  filePath: z.string().min(1),
  caption: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

assetsRouter.get("/health", (req, res) => {
  sendSuccess(res, { module: "assets", tenant: req.tenant, status: "healthy" });
});

assetsRouter.get("/", requirePermission("assets:view"), assetsController.listAll);
assetsRouter.get("/:id", requirePermission("assets:view"), assetsController.getById);
assetsRouter.get("/:id/depreciation", requirePermission("assets:view"), assetsController.getDepreciation);
assetsRouter.get("/:id/documents", requirePermission("assets:view"), assetsController.listDocuments);
assetsRouter.post("/:id/documents", requirePermission("assets:edit"), validateRequest({ body: addDocumentSchema }), assetsController.addDocument);
assetsRouter.get("/:id/photos", requirePermission("assets:view"), assetsController.listPhotos);
assetsRouter.post("/:id/photos", requirePermission("assets:edit"), validateRequest({ body: addPhotoSchema }), assetsController.addPhoto);

// Phase 5 Lifecycle Sub-resources
assetsRouter.get("/:id/assignments", requirePermission("assets:view"), async (req, res, next) => {
  try {
    const companyId = req.user!.isCommonAdmin ? undefined : req.user!.companyId!;
    const list = await assignmentsRepository.list({ assetId: req.params.id, companyId });
    sendSuccess(res, list.assignments, "Asset assignments history retrieved");
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/:id/returns", requirePermission("assets:view"), async (req, res, next) => {
  try {
    const companyId = req.user!.isCommonAdmin ? undefined : req.user!.companyId!;
    const list = await returnsRepository.list({ assetId: req.params.id, companyId });
    sendSuccess(res, list.returns, "Asset returns history retrieved");
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/:id/damage-inspections", requirePermission("assets:view"), async (req, res, next) => {
  try {
    const companyId = req.user!.isCommonAdmin ? undefined : req.user!.companyId!;
    const list = await damageInspectionsRepository.list({ assetId: req.params.id, companyId });
    sendSuccess(res, list.inspections, "Asset damage inspections retrieved");
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/:id/maintenance", requirePermission("assets:view"), async (req, res, next) => {
  try {
    const companyId = req.user!.isCommonAdmin ? undefined : req.user!.companyId!;
    const list = await maintenanceRepository.list({ assetId: req.params.id, companyId });
    sendSuccess(res, list.workOrders, "Asset maintenance work orders retrieved");
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/:id/transfers", requirePermission("assets:view"), async (req, res, next) => {
  try {
    const list = await transfersService.listAssetTransfers(req.params.id, req.user!);
    sendSuccess(res, list, "Asset transfers history retrieved");
  } catch (err) {
    next(err);
  }
});

// Phase 8 Identity & Scanning Sub-resources
assetsRouter.get("/:id/qr", requirePermission("labels:view"), scanController.getAssetQr);
assetsRouter.post("/:id/qr/regenerate", requirePermission("labels:generate"), scanController.regenerateQr);
assetsRouter.get("/:id/barcode", requirePermission("labels:view"), scanController.getAssetBarcode);
assetsRouter.post("/:id/labels/print", requirePermission("labels:print"), scanController.printLabel);
assetsRouter.post("/labels/batch", requirePermission("labels:print"), scanController.getBatchLabels);
assetsRouter.get("/:id/scans", requirePermission("scan:history"), scanController.listAssetScans);

assetsRouter.post("/", requirePermission("assets:create"), validateRequest({ body: createAssetSchema }), assetsController.create);
assetsRouter.put("/:id", requirePermission("assets:edit"), validateRequest({ body: updateAssetSchema }), assetsController.update);

// Preserved for Phase 2 tests
assetsRouter.delete("/:id", requirePermission("assets:retire"), async (req, res, next) => {
  try {
    await assetsRepository.delete(req.params.id, req.user!);
    sendSuccess(res, null, "Asset removed successfully");
  } catch (error) {
    next(error);
  }
});