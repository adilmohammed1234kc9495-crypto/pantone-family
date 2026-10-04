import { Router } from "express";
import { z } from "zod";
import { categoriesController } from "./categories.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const categoriesRouter = Router();

categoriesRouter.use(authenticate, resolveTenantContext);

const createCategorySchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.number().min(0).max(100).optional(),
  usefulLifeMonths: z.number().int().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().nullable().optional(),
  depreciationMethod: z.string().optional(),
  depreciationRatePercent: z.number().min(0).max(100).optional(),
  usefulLifeMonths: z.number().int().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

categoriesRouter.get("/", requirePermission("categories:view"), categoriesController.listAll);
categoriesRouter.get("/:id", requirePermission("categories:view"), categoriesController.getById);
categoriesRouter.post("/", requirePermission("categories:manage"), validateRequest({ body: createCategorySchema }), categoriesController.create);
categoriesRouter.put("/:id", requirePermission("categories:manage"), validateRequest({ body: updateCategorySchema }), categoriesController.update);
categoriesRouter.patch("/:id/status", requirePermission("categories:manage"), validateRequest({ body: updateStatusSchema }), categoriesController.updateStatus);