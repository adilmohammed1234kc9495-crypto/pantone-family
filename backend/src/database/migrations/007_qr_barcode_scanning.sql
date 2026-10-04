-- Migration: 007_qr_barcode_scanning.sql
-- Description: Phase 8 - Physical Asset QR & Barcode Scanning, Label Printing, and Scan Audit History

-- 1. Create asset_scans table for physical verification audit logs
CREATE TABLE IF NOT EXISTS asset_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    scanned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL DEFAULT 'QR',
    scan_value VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'WEB_CAMERA',
    is_success BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_scan_type CHECK (scan_type IN ('QR', 'BARCODE', 'MANUAL')),
    CONSTRAINT chk_scan_source CHECK (source IN ('WEB_CAMERA', 'MANUAL_ENTRY', 'HARDWARE_SCANNER'))
);

-- 2. Indexes for scan tracking and tenant-scoped performance
CREATE INDEX IF NOT EXISTS idx_asset_scans_asset ON asset_scans(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scans_company ON asset_scans(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_scans_user ON asset_scans(scanned_by);
CREATE INDEX IF NOT EXISTS idx_asset_scans_time ON asset_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_scans_type ON asset_scans(scan_type);

-- 3. Ensure lookup indexes on assets
CREATE INDEX IF NOT EXISTS idx_assets_barcode ON assets(barcode);
CREATE INDEX IF NOT EXISTS idx_assets_qr_code ON assets(qr_code);

-- 4. Seed Phase 8 RBAC Permissions
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('scan:view', 'scan', 'view', 'Permission to access scanning interface and lookup tools'),
    ('scan:resolve', 'scan', 'resolve', 'Permission to resolve scanned physical QR and barcode tokens to assets'),
    ('scan:history', 'scan', 'history', 'Permission to inspect physical scan event history and audit logs'),
    ('labels:view', 'labels', 'view', 'Permission to preview printable QR and Code 128 asset labels'),
    ('labels:print', 'labels', 'print', 'Permission to print individual or batch asset labels'),
    ('labels:generate', 'labels', 'generate', 'Permission to generate and regenerate asset machine identities')
ON CONFLICT (code) DO NOTHING;

-- 5. Grant permissions to standard system roles across all companies
DO $$
DECLARE
    r RECORD;
    p RECORD;
BEGIN
    FOR r IN SELECT id, code, company_id FROM roles LOOP
        FOR p IN SELECT id, code FROM permissions WHERE code IN ('scan:view', 'scan:resolve', 'scan:history', 'labels:view', 'labels:print', 'labels:generate') LOOP
            -- COMPANY_ADMIN gets all 6 permissions
            IF r.code = 'COMPANY_ADMIN' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- ASSET_MANAGER gets all 6 permissions
            ELSIF r.code = 'ASSET_MANAGER' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- DEPT_MANAGER gets scan view/resolve/history, labels view/print
            ELSIF r.code = 'DEPT_MANAGER' AND p.code IN ('scan:view', 'scan:resolve', 'scan:history', 'labels:view', 'labels:print') THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- EMPLOYEE gets scan view and resolve
            ELSIF r.code = 'EMPLOYEE' AND p.code IN ('scan:view', 'scan:resolve') THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- AUDITOR gets read-only view and scan history
            ELSIF r.code = 'AUDITOR' AND p.code IN ('scan:view', 'scan:resolve', 'scan:history', 'labels:view') THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;
