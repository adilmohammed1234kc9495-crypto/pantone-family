import { Router, Request, Response } from "express";
import { z } from "zod";
import { usersController } from "./users.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { sendSuccess } from "../../utils/response";

export const usersRouter = Router();

usersRouter.use(authenticate, resolveTenantContext);

const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  roleId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional()
});

const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  roleId: z.string().uuid().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional()
});

const updateStatusSchema = z.object({
  isActive: z.boolean()
});

usersRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "users",
    tenant: req.tenant,
    status: "healthy"
  }, "Module users initialized and tenant-scoped");
});

usersRouter.get("/", requirePermission("users:view"), usersController.list);
usersRouter.post("/", requirePermission("users:manage"), validateRequest({ body: createUserSchema }), usersController.create);
usersRouter.get("/:id", requirePermission("users:view"), usersController.getById);
usersRouter.put("/:id", requirePermission("users:manage"), validateRequest({ body: updateUserSchema }), usersController.update);
usersRouter.patch("/:id/status", requirePermission("users:manage"), validateRequest({ body: updateStatusSchema }), usersController.updateStatus);