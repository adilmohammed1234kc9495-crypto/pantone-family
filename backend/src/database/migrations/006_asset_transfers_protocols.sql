-- Migration 006: Asset Transfers, Inter-Company Protocols & Physical Handover Verification

-- 1. Enhance asset_transfers Table
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS dispatch_date TIMESTAMPTZ;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMPTZ;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS condition_before VARCHAR(50) DEFAULT 'GOOD';
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS condition_after VARCHAR(50);
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE asset_transfers ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Update transfer status check constraint
ALTER TABLE asset_transfers DROP CONSTRAINT IF EXISTS chk_transfer_status;
ALTER TABLE asset_transfers ADD CONSTRAINT chk_transfer_status CHECK (
    status IN ('INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING', 'COMPLETED', 'REJECTED', 'DISPUTED', 'CANCELLED')
);

CREATE INDEX IF NOT EXISTS idx_transfers_asset ON asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_company ON asset_transfers(from_company_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_company ON asset_transfers(to_company_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON asset_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_type ON asset_transfers(transfer_type);

-- 2. Enhance inter_company_transfers Table
ALTER TABLE inter_company_transfers ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE inter_company_transfers ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE inter_company_transfers DROP CONSTRAINT IF EXISTS chk_inter_status;
ALTER TABLE inter_company_transfers ADD CONSTRAINT chk_inter_status CHECK (
    status IN ('INITIATED', 'PENDING_RECEIPT', 'CONFIRMED', 'DISPUTED', 'CANCELLED')
);

-- 3. Enhance handover_records Table
ALTER TABLE handover_records ADD COLUMN IF NOT EXISTS physical_condition VARCHAR(50) DEFAULT 'GOOD';
ALTER TABLE handover_records ADD COLUMN IF NOT EXISTS digital_signature_token VARCHAR(255);
ALTER TABLE handover_records ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 4. Update asset status check constraint to support IN_TRANSIT and DISPUTED
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_asset_status;
ALTER TABLE assets ADD CONSTRAINT chk_asset_status CHECK (
    status IN ('AVAILABLE', 'IN_STOCK', 'ASSIGNED', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'RETURNED', 'TRANSFERRED', 'IN_TRANSIT', 'DISPUTED', 'RETIRED', 'DISPOSED')
);

-- 5. Sequence generator for Transfer Codes (TRF-YYYYMMDD-XXXX)
CREATE SEQUENCE IF NOT EXISTS transfer_seq START 1;

-- 6. Seed Phase 7 Transfer Permissions
INSERT INTO permissions (code, module, action, description)
VALUES 
    ('transfers:view', 'transfers', 'view', 'Permission to view internal and inter-company transfers'),
    ('transfers:create', 'transfers', 'create', 'Permission to initiate asset transfer requests'),
    ('transfers:approve', 'transfers', 'approve', 'Permission to authorize outgoing asset transfers'),
    ('transfers:dispatch', 'transfers', 'dispatch', 'Permission to mark transfer as dispatched / in-transit'),
    ('transfers:receive', 'transfers', 'receive', 'Permission to inspect and confirm receipt of transfers'),
    ('transfers:dispute', 'transfers', 'dispute', 'Permission to flag dispute on transferred assets'),
    ('transfers:cancel', 'transfers', 'cancel', 'Permission to cancel uncompleted transfers')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to standard company roles across all companies
DO $$
DECLARE
    r RECORD;
    p RECORD;
BEGIN
    FOR r IN SELECT id, code, company_id FROM roles LOOP
        FOR p IN SELECT id, code FROM permissions WHERE code LIKE 'transfers:%' LOOP
            -- COMPANY_ADMIN gets all transfer permissions
            IF r.code = 'COMPANY_ADMIN' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- ASSET_MANAGER gets view, create, approve, dispatch, receive, dispute, cancel
            ELSIF r.code = 'ASSET_MANAGER' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- DEPT_MANAGER gets view, create, approve, receive
            ELSIF r.code = 'DEPT_MANAGER' AND p.code IN ('transfers:view', 'transfers:create', 'transfers:approve', 'transfers:receive') THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- EMPLOYEE gets view and create (internal transfer request)
            ELSIF r.code = 'EMPLOYEE' AND p.code IN ('transfers:view', 'transfers:create') THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            -- AUDITOR gets read-only view
            ELSIF r.code = 'AUDITOR' AND p.code = 'transfers:view' THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (r.id, p.id) ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;
