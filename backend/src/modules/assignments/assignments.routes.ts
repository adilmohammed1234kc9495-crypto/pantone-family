import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission, requireAnyPermission } from "../../middleware/rbac.middleware";
import { assignmentsController } from "./assignments.controller";

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticate, resolveTenantContext);

assignmentsRouter.get(
  "/",
  requirePermission("assignments:view"),
  assignmentsController.listAssignments.bind(assignmentsController)
);

assignmentsRouter.post(
  "/",
  requireAnyPermission("assignments:assign", "assets:manage"),
  assignmentsController.assignAsset.bind(assignmentsController)
);

assignmentsRouter.get(
  "/:id",
  requirePermission("assignments:view"),
  assignmentsController.getAssignmentById.bind(assignmentsController)
);

assignmentsRouter.post(
  "/:id/handover",
  requireAnyPermission("assignments:assign", "handovers:sign"),
  assignmentsController.confirmHandover.bind(assignmentsController)
);