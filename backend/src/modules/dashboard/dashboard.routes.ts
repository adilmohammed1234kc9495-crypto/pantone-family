import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, resolveTenantContext);

dashboardRouter.get("/stats", dashboardController.getStats);
