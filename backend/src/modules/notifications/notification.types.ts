export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";

export type NotificationType =
  // Asset & Custody
  | "ASSET_ASSIGNED"
  | "ASSET_RETURNED"
  | "ASSET_RETURN_DUE"
  | "ASSET_RETURN_OVERDUE"
  | "DAMAGE_REPORTED"
  | "DAMAGE_INSPECTION_REQUIRED"
  // Maintenance
  | "MAINTENANCE_CREATED"
  | "MAINTENANCE_ASSIGNED"
  | "MAINTENANCE_IN_PROGRESS"
  | "MAINTENANCE_COMPLETED"
  | "MAINTENANCE_VERIFIED"
  | "MAINTENANCE_CLOSED"
  // Stock
  | "STOCK_LOW"
  | "STOCK_OUT"
  // Requests & Approvals
  | "REQUISITION_SUBMITTED"
  | "REQUISITION_APPROVAL_REQUIRED"
  | "REQUISITION_APPROVED"
  | "REQUISITION_REJECTED"
  | "REQUISITION_FULFILLED"
  // Transfers
  | "TRANSFER_CREATED"
  | "TRANSFER_APPROVAL_REQUIRED"
  | "TRANSFER_APPROVED"
  | "TRANSFER_REJECTED"
  | "TRANSFER_HANDOVER_REQUIRED"
  | "TRANSFER_RECEIPT_REQUIRED"
  | "TRANSFER_DISPUTED"
  | "TRANSFER_COMPLETED"
  // Inter-Company
  | "INTERCOMPANY_TRANSFER_CREATED"
  | "INTERCOMPANY_TRANSFER_RECEIPT_REQUIRED"
  | "INTERCOMPANY_TRANSFER_DISPUTED"
  // Security & System
  | "ASSET_SCAN_SECURITY_ALERT"
  | "SYSTEM_SECURITY_ALERT"
  | "USER_LOGIN_SUCCESS"
  | "USER_LOGIN_FAILURE"
  | "USER_ACCOUNT_LOCKED"
  | "IMPORTANT_ADMIN_ACTION";

export type AuditCategory =
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "ASSET"
  | "CUSTODY"
  | "MAINTENANCE"
  | "STOCK"
  | "REQUEST"
  | "APPROVAL"
  | "TRANSFER"
  | "INTERCOMPANY_TRANSFER"
  | "SCAN"
  | "REPORT"
  | "ADMINISTRATION"
  | "SECURITY"
  | "SYSTEM";

export interface CreateNotificationInput {
  userId: string;
  companyId?: string | null;
  notificationType?: NotificationType | string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  type?: string; // Backwards compatibility for existing callers
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  expiresAt?: Date | string | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  company_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  type: string;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
  expires_at: string | null;
  idempotency_key: string | null;
}

export interface UserNotificationPreferences {
  id: string;
  user_id: string;
  company_id: string | null;
  asset_events: boolean;
  maintenance_events: boolean;
  stock_events: boolean;
  request_events: boolean;
  transfer_events: boolean;
  security_alerts: boolean;
  updated_at: string;
}

export interface UpdatePreferencesInput {
  assetEvents?: boolean;
  maintenanceEvents?: boolean;
  stockEvents?: boolean;
  requestEvents?: boolean;
  transferEvents?: boolean;
  securityAlerts?: boolean;
}

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  isRead?: boolean;
  notificationType?: string;
  severity?: NotificationSeverity;
  startDate?: string;
  endDate?: string;
}

/**
 * Maps a NotificationType to its user preference key.
 * Critical alerts cannot be suppressed even if the preference is false.
 */
export function getPreferenceKeyForNotification(type: NotificationType | string): keyof Omit<UserNotificationPreferences, "id" | "user_id" | "company_id" | "updated_at"> | null {
  switch (type) {
    case "ASSET_ASSIGNED":
    case "ASSET_RETURNED":
    case "ASSET_RETURN_DUE":
    case "ASSET_RETURN_OVERDUE":
    case "DAMAGE_REPORTED":
    case "DAMAGE_INSPECTION_REQUIRED":
      return "asset_events";

    case "MAINTENANCE_CREATED":
    case "MAINTENANCE_ASSIGNED":
    case "MAINTENANCE_IN_PROGRESS":
    case "MAINTENANCE_COMPLETED":
    case "MAINTENANCE_VERIFIED":
    case "MAINTENANCE_CLOSED":
      return "maintenance_events";

    case "STOCK_LOW":
    case "STOCK_OUT":
      return "stock_events";

    case "REQUISITION_SUBMITTED":
    case "REQUISITION_APPROVAL_REQUIRED":
    case "REQUISITION_APPROVED":
    case "REQUISITION_REJECTED":
    case "REQUISITION_FULFILLED":
      return "request_events";

    case "TRANSFER_CREATED":
    case "TRANSFER_APPROVAL_REQUIRED":
    case "TRANSFER_APPROVED":
    case "TRANSFER_REJECTED":
    case "TRANSFER_HANDOVER_REQUIRED":
    case "TRANSFER_RECEIPT_REQUIRED":
    case "TRANSFER_DISPUTED":
    case "TRANSFER_COMPLETED":
    case "INTERCOMPANY_TRANSFER_CREATED":
    case "INTERCOMPANY_TRANSFER_RECEIPT_REQUIRED":
    case "INTERCOMPANY_TRANSFER_DISPUTED":
      return "transfer_events";

    case "ASSET_SCAN_SECURITY_ALERT":
    case "SYSTEM_SECURITY_ALERT":
    case "USER_LOGIN_SUCCESS":
    case "USER_LOGIN_FAILURE":
    case "USER_ACCOUNT_LOCKED":
    case "IMPORTANT_ADMIN_ACTION":
      return "security_alerts";

    default:
      return null;
  }
}

/**
 * Returns true if the notification is a critical or compliance event that MUST NEVER be suppressed.
 */
export function isNonSuppressibleNotification(type: NotificationType | string, severity?: NotificationSeverity): boolean {
  if (severity === "CRITICAL") {
    return true;
  }
  const nonSuppressibleTypes = [
    "SYSTEM_SECURITY_ALERT",
    "ASSET_SCAN_SECURITY_ALERT",
    "USER_ACCOUNT_LOCKED",
    "TRANSFER_DISPUTED",
    "INTERCOMPANY_TRANSFER_DISPUTED"
  ];
  return nonSuppressibleTypes.includes(type);
}
