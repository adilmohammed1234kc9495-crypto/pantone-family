import { Router } from "express";
import { z } from "zod";
import { vendorsController } from "./vendors.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const vendorsRouter = Router();

vendorsRouter.use(authenticate, resolveTenantContext);

const createVendorSchema = z.object({
  companyId: z.string().uuid().optional(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  contactPerson: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).optional(),
});

const updateVendorSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  contactPerson: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

vendorsRouter.get("/", requirePermission("vendors:view"), vendorsController.listAll);
vendorsRouter.get("/:id", requirePermission("vendors:view"), vendorsController.getById);
vendorsRouter.post("/", requirePermission("vendors:manage"), validateRequest({ body: createVendorSchema }), vendorsController.create);
vendorsRouter.put("/:id", requirePermission("vendors:manage"), validateRequest({ body: updateVendorSchema }), vendorsController.update);
vendorsRouter.patch("/:id/status", requirePermission("vendors:manage"), validateRequest({ body: updateStatusSchema }), vendorsController.updateStatus);