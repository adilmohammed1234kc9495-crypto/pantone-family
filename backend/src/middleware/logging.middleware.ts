import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const logData = { method, path: originalUrl, statusCode, duration, ip };

    if (statusCode >= 500) {
      logger.error("HTTP Request Error", logData);
    } else if (statusCode >= 400) {
      logger.warn("HTTP Client Request Warning", logData);
    } else {
      logger.info("HTTP Request Completed", logData);
    }
  });

  next();
}