import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  error?: {
    code?: string;
    details?: unknown;
  };
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200,
  meta?: ApiResponse["meta"]
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(res: Response, data: T, message = "Resource created successfully"): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = "Data retrieved successfully",
  keyName = "items"
): Response {
  const payload: Record<string, unknown> = {
    [keyName]: items,
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / Math.max(1, limit))
  };
  return sendSuccess(res, payload, message, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / Math.max(1, limit))
  });
}

