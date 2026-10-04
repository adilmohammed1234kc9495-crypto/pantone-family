-- Migration 009: Notifications, System Events & Audit Hardening

-- 1. ENHANCE NOTIFICATIONS TABLE
ALTER TABLE notifications 
    ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'INFO',
    ADD COLUMN IF NOT EXISTS notification_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS action_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Backfill existing rows
UPDATE notifications SET notification_type = type WHERE notification_type IS NULL;
UPDATE notifications SET severity = 'INFO' WHERE severity IS NULL;
UPDATE notifications SET read_at = created_at WHERE is_read = true AND read_at IS NULL;

-- Indexes for high-performance notification querying
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type_created ON notifications(notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_company_user ON notifications(company_id, user_id);

-- 2. USER NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    asset_events BOOLEAN NOT NULL DEFAULT true,
    maintenance_events BOOLEAN NOT NULL DEFAULT true,
    stock_events BOOLEAN NOT NULL DEFAULT true,
    request_events BOOLEAN NOT NULL DEFAULT true,
    transfer_events BOOLEAN NOT NULL DEFAULT true,
    security_alerts BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_notification_prefs UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_company ON user_notification_preferences(company_id);

-- 3. AUDIT LOGS ENHANCEMENTS
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'SYSTEM',
    ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'INFO',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SUCCESS';

-- Backfill categories for existing records based on action
UPDATE audit_logs SET category = 'AUTHENTICATION' WHERE action IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGOUT_ALL', 'TOKEN_REFRESH') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'AUTHORIZATION' WHERE action IN ('ROLE_UPDATED', 'PERMISSION_CHANGED') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'SECURITY' WHERE action IN ('UNAUTHORIZED_ACCESS_ATTEMPT', 'FORBIDDEN_ACCESS_ATTEMPT', 'IDOR_ATTEMPT', 'HEADER_TENANT_TAMPERING', 'QUERY_TENANT_TAMPERING', 'BODY_TENANT_TAMPERING', 'USER_ACCOUNT_LOCKED', 'ASSET_SCAN_FAILED') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'ASSET' WHERE entity = 'assets' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'CUSTODY' WHERE entity IN ('asset_assignments', 'asset_returns', 'handovers') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'MAINTENANCE' WHERE entity = 'maintenance' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'STOCK' WHERE entity IN ('stock_items', 'stock_movements') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'REQUEST' WHERE entity = 'asset_requests' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'APPROVAL' WHERE entity IN ('approvals', 'approval_workflows') AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'TRANSFER' WHERE entity = 'asset_transfers' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'SCAN' WHERE entity = 'asset_scans' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'REPORT' WHERE entity = 'reports' AND (category IS NULL OR category = 'SYSTEM');
UPDATE audit_logs SET category = 'ADMINISTRATION' WHERE entity IN ('companies', 'users', 'roles', 'branches', 'departments', 'locations', 'vendors') AND (category IS NULL OR category = 'SYSTEM');

UPDATE audit_logs SET severity = 'CRITICAL' WHERE action IN ('FORBIDDEN_ACCESS_ATTEMPT', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'IDOR_ATTEMPT', 'HEADER_TENANT_TAMPERING', 'QUERY_TENANT_TAMPERING', 'BODY_TENANT_TAMPERING', 'USER_ACCOUNT_LOCKED', 'TRANSFER_DISPUTED');
UPDATE audit_logs SET severity = 'WARNING' WHERE action IN ('LOGIN_FAILED', 'LOW_STOCK', 'STOCK_OUT', 'RETURN_OVERDUE');

CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- 4. RBAC PERMISSIONS FOR NOTIFICATIONS
INSERT INTO permissions (code, module, action, description) VALUES
    ('notifications:view', 'notifications', 'view', 'Permission to view own notification inbox and unread counts'),
    ('notifications:manage', 'notifications', 'manage', 'Permission to manage notification preferences and dismiss alerts')
ON CONFLICT (code) DO NOTHING;

-- Grant to all active system roles across companies
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('notifications:view', 'notifications:manage')
ON CONFLICT DO NOTHING;
