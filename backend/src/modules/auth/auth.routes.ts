import { Router } from "express";
import { z } from "zod";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, "Password is required")
}).refine((data) => data.username || data.email, {
  message: "Either username or email must be provided",
  path: ["username"]
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

const logoutSchema = z.object({
  refreshToken: z.string().optional()
});

authRouter.post("/login", validateRequest({ body: loginSchema }), authController.login);
authRouter.post("/refresh", validateRequest({ body: refreshSchema }), authController.refresh);
authRouter.post("/logout", authenticate, validateRequest({ body: logoutSchema }), authController.logout);
authRouter.post("/logout-all", authenticate, authController.logoutAll);
authRouter.get("/me", authenticate, authController.me);