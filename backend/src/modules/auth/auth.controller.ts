import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { sendSuccess } from "../../utils/response";

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password } = req.body;
      const identifier = (username || email) as string;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.get("user-agent");

      const result = await authService.login(identifier, password, ip, userAgent);
      sendSuccess(res, result, "Authentication successful");
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.get("user-agent");

      const result = await authService.refreshToken(refreshToken, ip, userAgent);
      sendSuccess(res, result, "Token refreshed successfully");
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.user!.id);
      sendSuccess(res, user, "Current user profile");
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      await authService.logout(req.user!.id, refreshToken);
      sendSuccess(res, null, "Logged out successfully");
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAll(req.user!.id);
      sendSuccess(res, null, "All active sessions have been revoked");
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();