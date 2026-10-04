import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requireAnyPermission } from "../../middleware/rbac.middleware";
import { returnsController } from "./returns.controller";

export const returnsRouter = Router();

returnsRouter.use(authenticate, resolveTenantContext);

returnsRouter.get(
  "/",
  requireAnyPermission("assignments:view", "assets:view"),
  returnsController.listReturns.bind(returnsController)
);

returnsRouter.post(
  "/",
  requireAnyPermission("assignments:return", "assets:manage"),
  returnsController.initiateReturn.bind(returnsController)
);

returnsRouter.get(
  "/:id",
  requireAnyPermission("assignments:view", "assets:view"),
  returnsController.getReturnById.bind(returnsController)
);

returnsRouter.post(
  "/:id/inspect",
  requireAnyPermission("assignments:return", "assets:manage"),
  returnsController.inspectReturn.bind(returnsController)
);