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

const optionalUuid = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? null : val),
  z.string().uuid().nullable().optional()
);

const optionalString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : typeof val === "string" ? val.trim() : val),
  z.string().nullable().optional()
);

const optionalTag = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : typeof val === "string" ? val.trim() : val),
  z.string().min(1).max(100).optional()
);

const conditionSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase().trim();
      if (upper === "POOR") return "DAMAGED";
      if (upper === "SCRAP") return "UNUSABLE";
      return upper;
    }
    return val;
  },
  z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]).optional()
);

const createAssetSchema = z.object({
  companyId: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.string().uuid().optional()
  ),
  branchId: optionalUuid,
  departmentId: optionalUuid,
  locationId: optionalUuid,
  categoryId: z.string().uuid({ message: "Valid category ID is required" }),
  vendorId: optionalUuid,
  assetTag: optionalTag,
  barcode: optionalTag,
  qrCode: optionalTag,
  name: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().min(1, { message: "Asset name must be at least 1 character" }).max(255)
  ),
  subcategory: optionalString,
  description: optionalString,
  serialNumber: optionalString,
  modelNumber: optionalString,
  manufacturer: optionalString,
  purchaseDate: optionalString,
  purchaseCost: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().min(0, { message: "Purchase cost must be a non-negative number" })
  ),
  currency: optionalString,
  salvageValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().min(0).optional()
  ),
  invoiceNumber: optionalString,
  warrantyStart: optionalString,
  warrantyEnd: optionalString,
  status: z.enum([
    "AVAILABLE", "IN_STOCK", "ASSIGNED", "UNDER_MAINTENANCE",
    "DAMAGED", "LOST", "RETURNED", "TRANSFERRED", "RETIRED", "DISPOSED"
  ]).optional(),
  condition: conditionSchema,
  photoUrl: optionalString,
  notes: optionalString,
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).max(100).optional()
  ),
  usefulLifeMonths: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Math.round(Number(val))),
    z.number().int().min(1).optional()
  ),
  depreciationStartDate: optionalString,
});

const updateAssetSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().min(1).max(255).optional()
  ),
  branchId: optionalUuid,
  departmentId: optionalUuid,
  locationId: optionalUuid,
  vendorId: optionalUuid,
  serialNumber: optionalString,
  modelNumber: optionalString,
  manufacturer: optionalString,
  condition: conditionSchema,
  notes: optionalString,
  description: optionalString,
  current_value: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).max(100).optional()
  ),
  usefulLifeMonths: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Math.round(Number(val))),
    z.number().int().min(1).optional()
  ),
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