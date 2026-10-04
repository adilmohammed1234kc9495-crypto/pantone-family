import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requireAnyPermission } from "../../middleware/rbac.middleware";
import { maintenanceController } from "./maintenance.controller";

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticate, resolveTenantContext);

maintenanceRouter.get(
  "/",
  requireAnyPermission("maintenance:view", "assets:view"),
  maintenanceController.listWorkOrders.bind(maintenanceController)
);

maintenanceRouter.post(
  "/",
  requireAnyPermission("maintenance:manage", "maintenance:log"),
  maintenanceController.createWorkOrder.bind(maintenanceController)
);

maintenanceRouter.get(
  "/:id",
  requireAnyPermission("maintenance:view", "assets:view"),
  maintenanceController.getWorkOrderById.bind(maintenanceController)
);

maintenanceRouter.patch(
  "/:id/status",
  requireAnyPermission("maintenance:manage"),
  maintenanceController.transitionStatus.bind(maintenanceController)
);

maintenanceRouter.patch(
  "/:id/costs",
  requireAnyPermission("maintenance:manage"),
  maintenanceController.recordCosts.bind(maintenanceController)
);