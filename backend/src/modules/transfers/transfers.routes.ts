import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission, requireAnyPermission } from "../../middleware/rbac.middleware";
import { transfersController } from "./transfers.controller";

export const transfersRouter = Router();

transfersRouter.use(authenticate, resolveTenantContext);

transfersRouter.get(
  "/",
  requireAnyPermission("transfers:view", "assets:view"),
  transfersController.list.bind(transfersController)
);

transfersRouter.post(
  "/",
  requirePermission("transfers:create"),
  transfersController.initiate.bind(transfersController)
);

transfersRouter.get(
  "/:id",
  requireAnyPermission("transfers:view", "assets:view"),
  transfersController.getById.bind(transfersController)
);

transfersRouter.post(
  "/:id/approve",
  requirePermission("transfers:approve"),
  transfersController.approve.bind(transfersController)
);

transfersRouter.post(
  "/:id/dispatch",
  requirePermission("transfers:dispatch"),
  transfersController.dispatch.bind(transfersController)
);

transfersRouter.post(
  "/:id/receive",
  requirePermission("transfers:receive"),
  transfersController.receive.bind(transfersController)
);

transfersRouter.post(
  "/:id/dispute",
  requirePermission("transfers:dispute"),
  transfersController.dispute.bind(transfersController)
);

transfersRouter.post(
  "/:id/cancel",
  requirePermission("transfers:cancel"),
  transfersController.cancel.bind(transfersController)
);