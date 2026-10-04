import { Router } from "express";
import { z } from "zod";
import { branchesController } from "./branches.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const branchesRouter = Router();

branchesRouter.use(authenticate, resolveTenantContext);

const createBranchSchema = z.object({
  companyId: z.string().uuid().optional(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const updateBranchSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

branchesRouter.get("/", requirePermission("branches:view"), branchesController.listAll);
branchesRouter.get("/:id", requirePermission("branches:view"), branchesController.getById);
branchesRouter.post("/", requirePermission("branches:manage"), validateRequest({ body: createBranchSchema }), branchesController.create);
branchesRouter.put("/:id", requirePermission("branches:manage"), validateRequest({ body: updateBranchSchema }), branchesController.update);
branchesRouter.patch("/:id/status", requirePermission("branches:manage"), validateRequest({ body: updateStatusSchema }), branchesController.updateStatus);
