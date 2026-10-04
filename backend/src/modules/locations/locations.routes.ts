import { Router } from "express";
import { z } from "zod";
import { locationsController } from "./locations.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const locationsRouter = Router();

locationsRouter.use(authenticate, resolveTenantContext);

const createLocationSchema = z.object({
  companyId: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  building: z.string().min(1).max(100),
  floor: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const updateLocationSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  building: z.string().min(1).max(100).optional(),
  floor: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

locationsRouter.get("/", requirePermission("locations:view"), locationsController.listAll);
locationsRouter.get("/:id", requirePermission("locations:view"), locationsController.getById);
locationsRouter.post("/", requirePermission("locations:manage"), validateRequest({ body: createLocationSchema }), locationsController.create);
locationsRouter.put("/:id", requirePermission("locations:manage"), validateRequest({ body: updateLocationSchema }), locationsController.update);
locationsRouter.patch("/:id/status", requirePermission("locations:manage"), validateRequest({ body: updateStatusSchema }), locationsController.updateStatus);