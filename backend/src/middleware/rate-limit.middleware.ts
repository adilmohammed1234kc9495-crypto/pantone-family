import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { TooManyRequestsError } from "../utils/errors";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipInTest?: boolean;
}) {
  const store: RateLimitStore = {};
  const { windowMs, max, message = "Too many requests, please try again later", skipInTest = true } = options;

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    }
  }, windowMs * 2).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skipInTest && env.NODE_ENV === "test") {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (!store[ip] || store[ip].resetTime <= now) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      return next();
    }

    store[ip].count += 1;
    const remaining = Math.max(0, max - store[ip].count);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(store[ip].resetTime / 1000));

    if (store[ip].count > max) {
      const retryAfterSeconds = Math.ceil((store[ip].resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return next(new TooManyRequestsError(message));
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 attempts per minute
  message: "Too many authentication requests. Please wait a minute before retrying.",
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: "API rate limit exceeded. Please throttle your requests.",
});
