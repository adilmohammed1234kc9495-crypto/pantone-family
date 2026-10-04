import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { notificationsController } from "./notifications.controller";
import { sendSuccess } from "../../utils/response";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate, resolveTenantContext);

// Health probe
notificationsRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "notifications",
    tenant: req.tenant,
    status: "healthy"
  }, "Module notifications initialized and tenant-scoped");
});

// Fixed endpoints before /:id parameter
notificationsRouter.get("/unread-count", notificationsController.getUnreadCount);
notificationsRouter.patch("/read-all", notificationsController.markAllRead);
notificationsRouter.get("/preferences", notificationsController.getPreferences);
notificationsRouter.put("/preferences", notificationsController.updatePreferences);

// List & Detail
notificationsRouter.get("/", notificationsController.list);
notificationsRouter.get("/:id", notificationsController.getById);
notificationsRouter.patch("/:id/read", notificationsController.markRead);