import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { approvalsController } from "./approvals.controller";

export const approvalsRouter = Router();

approvalsRouter.use(authenticate, resolveTenantContext);

// Pending approvals inbox for manager
approvalsRouter.get(
  "/pending",
  requirePermission("approvals:view"),
  (req, res, next) => approvalsController.getPendingApprovals(req, res, next)
);
