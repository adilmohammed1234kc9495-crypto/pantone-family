import { Router } from "express";
import { z } from "zod";
import { scanController } from "./scan.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { sendSuccess } from "../../utils/response";

export const scanRouter = Router();

scanRouter.use(authenticate, resolveTenantContext);

const resolveBodySchema = z.object({
  code: z.string().min(1, "Scan code or token is required"),
  scanType: z.enum(["QR", "BARCODE", "MANUAL"]).optional(),
  source: z.enum(["WEB_CAMERA", "MANUAL_ENTRY", "HARDWARE_SCANNER"]).optional()
});

scanRouter.get("/health", (req, res) => {
  sendSuccess(res, { module: "scan", tenant: req.tenant, status: "healthy" });
});

// Resolve Asset by token parameter (e.g. GET /api/v1/scan/assets/asset:UUID or /api/v1/scan/assets/AST-2026-XXXX)
scanRouter.get(
  "/assets/:token",
  requirePermission("scan:resolve"),
  scanController.resolveByToken
);

// Resolve Asset by body payload
scanRouter.post(
  "/resolve",
  requirePermission("scan:resolve"),
  validateRequest({ body: resolveBodySchema }),
  scanController.resolve
);

export const scansListRouter = Router();
scansListRouter.use(authenticate, resolveTenantContext);

// List scan events history
scansListRouter.get(
  "/",
  requirePermission("scan:history"),
  scanController.listScans
);
