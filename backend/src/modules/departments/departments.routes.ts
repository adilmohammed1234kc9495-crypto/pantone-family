import { Router } from "express";
import { z } from "zod";
import { departmentsController } from "./departments.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const departmentsRouter = Router();

departmentsRouter.use(authenticate, resolveTenantContext);

const createDepartmentSchema = z.object({
  companyId: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  headEmployeeId: z.string().uuid().nullable().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  branchId: z.string().uuid().nullable().optional(),
  headEmployeeId: z.string().uuid().nullable().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

departmentsRouter.get("/", requirePermission("departments:view"), departmentsController.listAll);
departmentsRouter.get("/:id", requirePermission("departments:view"), departmentsController.getById);
departmentsRouter.post("/", requirePermission("departments:manage"), validateRequest({ body: createDepartmentSchema }), departmentsController.create);
departmentsRouter.put("/:id", requirePermission("departments:manage"), validateRequest({ body: updateDepartmentSchema }), departmentsController.update);
departmentsRouter.patch("/:id/status", requirePermission("departments:manage"), validateRequest({ body: updateStatusSchema }), departmentsController.updateStatus);