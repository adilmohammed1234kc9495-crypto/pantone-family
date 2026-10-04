import { Router } from "express";
import { z } from "zod";
import { companiesController } from "./companies.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission, requireCommonAdmin } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const companiesRouter = Router();

companiesRouter.use(authenticate, resolveTenantContext);

const createCompanySchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional()
});

const updateStatusSchema = z.object({
  isActive: z.boolean()
});

const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  taxId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional()
});

// Common Admin only endpoints
companiesRouter.get("/", requireCommonAdmin, companiesController.listAll);
companiesRouter.post("/", requireCommonAdmin, validateRequest({ body: createCompanySchema }), companiesController.create);
companiesRouter.put("/:id", requireCommonAdmin, validateRequest({ body: updateCompanySchema }), companiesController.update);
companiesRouter.patch("/:id/status", requireCommonAdmin, validateRequest({ body: updateStatusSchema }), companiesController.updateStatus);

// Common Admin or Company User accessing own company
companiesRouter.get("/:id", requirePermission("companies:view"), companiesController.getById);
companiesRouter.get("/:id/activity", requirePermission("companies:view"), companiesController.getActivity);