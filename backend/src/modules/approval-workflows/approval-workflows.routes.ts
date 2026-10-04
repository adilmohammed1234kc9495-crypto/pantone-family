import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { approvalWorkflowsController } from "./approval-workflows.controller";

export const approvalWorkflowsRouter = Router();

approvalWorkflowsRouter.use(authenticate, resolveTenantContext);

approvalWorkflowsRouter.post(
  "/",
  requirePermission("approval_config:manage"),
  (req, res, next) => approvalWorkflowsController.createWorkflow(req, res, next)
);

approvalWorkflowsRouter.get(
  "/",
  requirePermission("approval_config:view"),
  (req, res, next) => approvalWorkflowsController.listWorkflows(req, res, next)
);

approvalWorkflowsRouter.get(
  "/:id",
  requirePermission("approval_config:view"),
  (req, res, next) => approvalWorkflowsController.getWorkflowById(req, res, next)
);

approvalWorkflowsRouter.put(
  "/:id",
  requirePermission("approval_config:manage"),
  (req, res, next) => approvalWorkflowsController.updateWorkflow(req, res, next)
);

