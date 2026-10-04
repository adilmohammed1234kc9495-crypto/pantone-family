import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requireAnyPermission } from "../../middleware/rbac.middleware";
import { damageInspectionsController } from "./damage-inspections.controller";

export const damageInspectionsRouter = Router();

damageInspectionsRouter.use(authenticate, resolveTenantContext);

damageInspectionsRouter.get(
  "/",
  requireAnyPermission("assets:view", "maintenance:view", "assignments:view"),
  damageInspectionsController.listInspections.bind(damageInspectionsController)
);

damageInspectionsRouter.post(
  "/",
  requireAnyPermission("assets:manage", "assignments:return", "maintenance:manage"),
  damageInspectionsController.recordInspection.bind(damageInspectionsController)
);

damageInspectionsRouter.get(
  "/:id",
  requireAnyPermission("assets:view", "maintenance:view", "assignments:view"),
  damageInspectionsController.getInspectionById.bind(damageInspectionsController)
);

damageInspectionsRouter.patch(
  "/:id/decision",
  requireAnyPermission("assets:manage", "maintenance:manage"),
  damageInspectionsController.resolveDecision.bind(damageInspectionsController)
);