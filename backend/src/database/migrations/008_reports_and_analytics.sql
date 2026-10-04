-- ==============================================================================
-- Migration: 008_reports_and_analytics.sql
-- Description: Phase 9 Reports, Analytics & Exports Permissions and Performance Indexes
-- ==============================================================================

-- 1. Seed Reporting Permissions
INSERT INTO permissions (code, module, action, description) VALUES
    ('reports:view', 'reports', 'view', 'Permission to access executive reporting dashboard and overview analytics'),
    ('reports:assets', 'reports', 'assets', 'Permission to view comprehensive fixed asset register report'),
    ('reports:depreciation', 'reports', 'depreciation', 'Permission to view straight-line depreciation reports'),
    ('reports:transfers', 'reports', 'transfers', 'Permission to view internal and inter-company asset transfer reports'),
    ('reports:custody', 'reports', 'custody', 'Permission to view custody assignment and return inspection reports'),
    ('reports:maintenance', 'reports', 'maintenance', 'Permission to view maintenance work orders and repair cost reports'),
    ('reports:stock', 'reports', 'stock', 'Permission to view stock inventory, valuation, and reorder reports'),
    ('reports:requests', 'reports', 'requests', 'Permission to view asset requisition and approval reports'),
    ('reports:audit', 'reports', 'audit', 'Permission to view system compliance and security audit trail reports'),
    ('reports:scans', 'reports', 'scans', 'Permission to view physical barcode and QR scanning reports'),
    ('reports:export', 'reports', 'export', 'Permission to export reports in CSV and XLSX formats')
ON CONFLICT (code) DO NOTHING;

-- 2. Grant permissions to standard system roles across all companies
DO $$
DECLARE
    r RECORD;
    p RECORD;
BEGIN
    FOR r IN SELECT id, code, company_id FROM roles LOOP
        FOR p IN SELECT id, code FROM permissions WHERE module = 'reports' LOOP
            -- COMPANY_ADMIN gets all 11 reporting permissions
            IF r.code = 'COMPANY_ADMIN' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- ASSET_MANAGER gets all 11 reporting permissions
            ELSIF r.code = 'ASSET_MANAGER' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- AUDITOR gets all 11 reporting permissions (read-only compliance)
            ELSIF r.code = 'AUDITOR' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- DEPT_MANAGER gets view, assets, transfers, custody, maintenance, requests, export
            ELSIF r.code = 'DEPT_MANAGER' AND p.code IN (
                'reports:view', 'reports:assets', 'reports:transfers', 'reports:custody',
                'reports:maintenance', 'reports:requests', 'reports:export'
            ) THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- EMPLOYEE gets no reporting permissions by default
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 3. Composite Covering Indexes for High-Performance Reporting & Aggregations
CREATE INDEX IF NOT EXISTS idx_assets_reporting ON assets (company_id, status, purchase_date);
CREATE INDEX IF NOT EXISTS idx_assets_dept_reporting ON assets (company_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_reporting ON maintenance_records (company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_reporting ON asset_transfers (from_company_id, to_company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_reporting ON asset_assignments (company_id, status, assigned_at);
CREATE INDEX IF NOT EXISTS idx_asset_requests_reporting ON asset_requests (company_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_items_reporting ON stock_items (company_id, status, quantity_on_hand);
