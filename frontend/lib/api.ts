/**
 * Production API Client for Pantone Fixed Asset Management System
 * Integrates with Phase 2 Authentication, Refresh Token Rotation, and Multi-Tenancy headers.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Token storage helpers
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pantone_access_token");
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pantone_access_token", token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pantone_refresh_token");
}

export function setRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pantone_refresh_token", token);
}

export function getStoredCompanyContext(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pantone_company_context");
}

export function setStoredCompanyContext(companyId: string | null): void {
  if (typeof window === "undefined") return;
  if (companyId) {
    localStorage.setItem("pantone_company_context", companyId);
  } else {
    localStorage.removeItem("pantone_company_context");
  }
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("pantone_access_token");
  localStorage.removeItem("pantone_refresh_token");
  localStorage.removeItem("pantone_company_context");
  localStorage.removeItem("pantone_user_profile");
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      clearAuthStorage();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return null;
    }

    const newAccessToken = data.data.accessToken;
    const newRefreshToken = data.data.refreshToken;
    setAccessToken(newAccessToken);
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
    }
    return newAccessToken;
  } catch {
    clearAuthStorage();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Attach company context if selected by Common Admin
    const companyContext = getStoredCompanyContext();
    if (companyContext) {
      headers["X-Company-Id"] = companyContext;
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  let response = await fetch(url, {
    ...restOptions,
    headers,
  });

  // Handle 401 Unauthorized - attempt silent token refresh
  if (response.status === 401 && requiresAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(url, {
          ...restOptions,
          headers,
        });
      }
    } else {
      // Queue requests while refreshing
      const retryPromise = new Promise<Response>((resolve) => {
        subscribeTokenRefresh(async (newToken: string) => {
          headers["Authorization"] = `Bearer ${newToken}`;
          const res = await fetch(url, { ...restOptions, headers });
          resolve(res);
        });
      });
      response = await retryPromise;
    }
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = result?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, result);
  }

  return result.data as T;
}

apiClient.get = function <T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "GET" });
};

apiClient.post = function <T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.put = function <T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.patch = function <T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

apiClient.delete = function <T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "DELETE" });
};

// Phase 8 Physical Asset Scanning & Label APIs
export const scanApi = {
  resolveByToken: (token: string, scanType = "QR", source = "WEB_CAMERA") =>
    apiClient.get<any>(`/scan/assets/${encodeURIComponent(token)}?scanType=${scanType}&source=${source}`),
  resolve: (code: string, scanType = "QR", source = "WEB_CAMERA") =>
    apiClient.post<any>("/scan/resolve", { code, scanType, source }),
  getQr: (assetId: string) => apiClient.get<any>(`/assets/${assetId}/qr`),
  regenerateQr: (assetId: string) => apiClient.post<any>(`/assets/${assetId}/qr/regenerate`),
  getBarcode: (assetId: string) => apiClient.get<any>(`/assets/${assetId}/barcode`),
  printLabel: (assetId: string) => apiClient.post<any>(`/assets/${assetId}/labels/print`),
  getBatchLabels: (assetIds: string[]) => apiClient.post<any>("/assets/labels/batch", { assetIds }),
  getAssetScans: (assetId: string) => apiClient.get<any>(`/assets/${assetId}/scans`),
  getScans: (params?: Record<string, any>) => {
    const query = params ? new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`/scans${query ? `?${query}` : ""}`);
  }
};

// Phase 9 Reports, Analytics & Exports APIs
export const reportsApi = {
  getDashboard: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/dashboard${q ? `?${q}` : ""}`);
  },
  getAssetRegister: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/assets${q ? `?${q}` : ""}`);
  },
  getDepreciation: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/depreciation${q ? `?${q}` : ""}`);
  },
  getTransfers: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/transfers${q ? `?${q}` : ""}`);
  },
  getCustody: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/custody${q ? `?${q}` : ""}`);
  },
  getMaintenance: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/maintenance${q ? `?${q}` : ""}`);
  },
  getStock: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/stock${q ? `?${q}` : ""}`);
  },
  getRequests: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/requests${q ? `?${q}` : ""}`);
  },
  getAudit: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/audit${q ? `?${q}` : ""}`);
  },
  getScans: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/reports/scans${q ? `?${q}` : ""}`);
  },
  downloadReport: async (type: string, format: "csv" | "xlsx", params: Record<string, any> = {}) => {
    const token = getAccessToken();
    const companyContext = getStoredCompanyContext();
    const cleanParams: Record<string, string> = { format };
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
    });
    const query = new URLSearchParams(cleanParams).toString();
    const url = `${API_BASE_URL}/reports/${type}/export?${query}`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (companyContext) headers["X-Company-Id"] = companyContext;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.message || `Export failed with status ${res.status}`, res.status, err);
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const disposition = res.headers.get("content-disposition");
    let filename = `${type}_report_${Date.now()}.${format}`;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },
};

export const notificationsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    severity?: string;
    notificationType?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "ALL") cleanParams[k] = String(v);
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    return apiClient.get<any>(`/notifications${q ? `?${q}` : ""}`);
  },
  getUnreadCount: () => {
    return apiClient.get<{ unreadCount: number }>("/notifications/unread-count");
  },
  markRead: (id: string) => {
    return apiClient.patch<{ id: string; isRead: boolean }>(`/notifications/${id}/read`, {});
  },
  markAllRead: () => {
    return apiClient.patch<{ markedCount: number }>("/notifications/read-all", {});
  },
  getById: (id: string) => {
    return apiClient.get<any>(`/notifications/${id}`);
  },
  getPreferences: () => {
    return apiClient.get<any>("/notifications/preferences");
  },
  updatePreferences: (data: Record<string, boolean>) => {
    return apiClient.put<any>("/notifications/preferences", data);
  },
};

