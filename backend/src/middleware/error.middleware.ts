import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";
import { env } from "../config/env";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  const timestamp = new Date().toISOString();
  const requestId = (req as any).id || (req.headers["x-request-id"] as string) || undefined;

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.statusCode}]: ${err.message}`, {
      path: req.originalUrl,
      method: req.method,
      details: err.details
    });

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { error: { details: err.details } } : {}),
      timestamp
    });
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    logger.warn(`ValidationError: ${err.message}`, {
      path: req.originalUrl,
      method: req.method
    });

    return res.status(422).json({
      success: false,
      message: "Request validation failed",
      error: {
        code: "VALIDATION_ERROR",
        details: err.flatten()
      },
      timestamp
    });
  }

  // 3. PostgreSQL Specific Database Errors
  const pgErr = err as { code?: string; table?: string; detail?: string; column?: string };
  if (pgErr.code) {
    // 23505: Unique constraint violation
    if (pgErr.code === "23505") {
      logger.warn(`PostgreSQL Unique Violation: ${pgErr.detail}`, { table: pgErr.table });
      return res.status(409).json({
        success: false,
        message: "A record with this unique identifier already exists",
        error: { code: "UNIQUE_VIOLATION", detail: pgErr.detail },
        timestamp
      });
    }

    // 23503: Foreign key constraint violation
    if (pgErr.code === "23503") {
      logger.warn(`PostgreSQL Foreign Key Violation: ${pgErr.detail}`, { table: pgErr.table });
      return res.status(400).json({
        success: false,
        message: "Referenced entity does not exist or cannot be modified due to foreign key constraints",
        error: { code: "FOREIGN_KEY_VIOLATION", detail: pgErr.detail },
        timestamp
      });
    }

    // 23502: Not-null constraint violation
    if (pgErr.code === "23502") {
      logger.warn(`PostgreSQL Not Null Violation on column ${pgErr.column}`);
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${pgErr.column}`,
        error: { code: "NOT_NULL_VIOLATION", column: pgErr.column },
        timestamp
      });
    }

    // 22P02: Invalid input syntax (e.g. invalid UUID format)
    if (pgErr.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid input syntax (e.g. malformed UUID)",
        error: { code: "INVALID_SYNTAX" },
        timestamp
      });
    }
  }

  // 4. JWT Verification Errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: err.name === "TokenExpiredError" ? "Token has expired" : "Invalid authentication token",
      error: { code: "AUTHENTICATION_FAILED" },
      timestamp
    });
  }

  // 5. Unhandled Server Errors (500)
  logger.error("Unhandled Internal Server Error", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  return res.status(500).json({
    success: false,
    message: "An internal server error occurred",
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      ...(requestId ? { request_id: requestId } : {}),
      ...(env.NODE_ENV !== "production" ? { detail: err.message, stack: err.stack } : {})
    },
    timestamp
  });
}