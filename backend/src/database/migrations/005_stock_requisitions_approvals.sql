-- ============================================================================
-- Migration: 005_stock_requisitions_approvals.sql
-- Description: Phase 6 - Stock Management, Asset Requisitions & Multi-Level Approvals
-- ============================================================================

BEGIN;

-- 1. ENHANCE STOCK_ITEMS TABLE
-- Allow stock items to represent physical components/materials independently of serialized assets
ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_items_asset_id_key;
ALTER TABLE stock_items ALTER COLUMN asset_id DROP NOT NULL;

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS stock_code VARCHAR(50);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT 'PIECE';
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS quantity_on_hand INT NOT NULL DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS minimum_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS reorder_level INT NOT NULL DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS maximum_quantity INT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add check constraint for non-negative stock quantity
ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS chk_stock_quantity_non_negative;
ALTER TABLE stock_items ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (quantity_on_hand >= 0);

-- Unique stock code per company
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_items_company_code ON stock_items(company_id, stock_code);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_location ON stock_items(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_company ON stock_items(company_id);

-- 2. ENHANCE STOCK_MOVEMENTS TABLE
ALTER TABLE stock_movements ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stock_item_id UUID REFERENCES stock_items(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS balance_before INT NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS balance_after INT NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Validate movement types
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movement_type CHECK (
    movement_type IN ('RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'DAMAGE', 'SCRAP')
);

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movement_quantity;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movement_quantity CHECK (quantity > 0);

CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- 3. ENHANCE ASSET_REQUESTS TABLE
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(100);
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS required_by_date DATE;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS preferred_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS current_approval_level INT NOT NULL DEFAULT 1;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS fulfilled_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS fulfilled_stock_movement_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL;
ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;
ALTER TABLE asset_requests ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE asset_requests ALTER COLUMN reason DROP NOT NULL;

-- Update request status check constraint
ALTER TABLE asset_requests DROP CONSTRAINT IF EXISTS chk_request_status;
ALTER TABLE asset_requests ADD CONSTRAINT chk_request_status CHECK (
    status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_requests_number ON asset_requests(request_number) WHERE request_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_requests_requester ON asset_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_department ON asset_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON asset_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_requests_company ON asset_requests(company_id);

-- 4. ENHANCE ASSET_REQUEST_APPROVALS TABLE
ALTER TABLE asset_request_approvals ALTER COLUMN approver_id DROP NOT NULL;
ALTER TABLE asset_request_approvals ALTER COLUMN decision DROP NOT NULL;
ALTER TABLE asset_request_approvals ADD COLUMN IF NOT EXISTS approval_level INT NOT NULL DEFAULT 1;
ALTER TABLE asset_request_approvals ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50) NOT NULL DEFAULT 'DEPT_MANAGER';
ALTER TABLE asset_request_approvals ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE asset_request_approvals ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE asset_request_approvals ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

ALTER TABLE asset_request_approvals DROP CONSTRAINT IF EXISTS chk_approval_status;
ALTER TABLE asset_request_approvals ADD CONSTRAINT chk_approval_status CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED')
);

ALTER TABLE asset_request_approvals DROP CONSTRAINT IF EXISTS chk_approval_decision;
ALTER TABLE asset_request_approvals ADD CONSTRAINT chk_approval_decision CHECK (
    decision IS NULL OR decision IN ('APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION')
);

CREATE INDEX IF NOT EXISTS idx_approvals_request ON asset_request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON asset_request_approvals(status);

-- 5. CREATE APPROVAL_WORKFLOWS TABLE
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'ASSET_REQUEST',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_workflow_active ON approval_workflows(company_id, request_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_approval_workflows_company ON approval_workflows(company_id);

-- 6. CREATE APPROVAL_WORKFLOW_STEPS TABLE
CREATE TABLE IF NOT EXISTS approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    role_code VARCHAR(50) NOT NULL,
    description VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workflow_step_order UNIQUE (workflow_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON approval_workflow_steps(workflow_id);

-- 7. CREATE REQUEST_HISTORY TABLE (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS request_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_history_request ON request_history(request_id);
CREATE INDEX IF NOT EXISTS idx_request_history_time ON request_history(created_at);

-- 8. SEED PHASE 6 PERMISSIONS
INSERT INTO permissions (code, module, action, description) VALUES
    ('stock:create', 'stock', 'create', 'Create stock items'),
    ('stock:update', 'stock', 'update', 'Update stock item metadata'),
    ('stock:movement', 'stock', 'movement', 'Record stock receipt, issue, and transfers'),
    ('stock:adjust', 'stock', 'adjust', 'Perform inventory adjustments on stock'),
    ('requests:submit', 'requests', 'submit', 'Submit draft requisition for multi-level approval'),
    ('requests:update', 'requests', 'update', 'Edit draft or returned requisition'),
    ('requests:cancel', 'requests', 'cancel', 'Cancel pending requisition'),
    ('requests:fulfill', 'requests', 'fulfill', 'Fulfill approved request from stock or serialized assets'),
    ('approvals:view', 'approvals', 'view', 'View pending approvals queue'),
    ('approvals:approve', 'approvals', 'approve', 'Approve requisition at assigned approval stage'),
    ('approvals:reject', 'approvals', 'reject', 'Reject requisition at assigned approval stage'),
    ('approvals:return', 'approvals', 'return', 'Return requisition to requester for revision'),
    ('approval_config:view', 'approval_config', 'view', 'View approval workflow configurations'),
    ('approval_config:manage', 'approval_config', 'manage', 'Create, update, and reorder approval workflow stages')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Roles
DO $$
DECLARE
    role_rec RECORD;
    perm_rec RECORD;
BEGIN
    -- Common Admin & Company Admin get all stock, requests, approvals, config
    FOR role_rec IN SELECT id, code FROM roles WHERE code IN ('COMMON_ADMIN', 'COMPANY_ADMIN') LOOP
        FOR perm_rec IN SELECT id FROM permissions WHERE module IN ('stock', 'requests', 'approvals', 'approval_config') LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (role_rec.id, perm_rec.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- Asset Manager gets stock management, request viewing/fulfillment, approvals
    FOR role_rec IN SELECT id, code FROM roles WHERE code = 'ASSET_MANAGER' LOOP
        FOR perm_rec IN SELECT id FROM permissions WHERE code IN (
            'stock:view', 'stock:create', 'stock:update', 'stock:movement', 'stock:adjust',
            'requests:view', 'requests:fulfill',
            'approvals:view', 'approvals:approve', 'approvals:reject', 'approvals:return',
            'approval_config:view'
        ) LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (role_rec.id, perm_rec.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- Department Manager gets requests and department approvals
    FOR role_rec IN SELECT id, code FROM roles WHERE code = 'DEPT_MANAGER' LOOP
        FOR perm_rec IN SELECT id FROM permissions WHERE code IN (
            'stock:view',
            'requests:view', 'requests:create', 'requests:update', 'requests:submit', 'requests:cancel',
            'approvals:view', 'approvals:approve', 'approvals:reject', 'approvals:return'
        ) LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (role_rec.id, perm_rec.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- Employee gets self-service requests
    FOR role_rec IN SELECT id, code FROM roles WHERE code = 'EMPLOYEE' LOOP
        FOR perm_rec IN SELECT id FROM permissions WHERE code IN (
            'requests:view', 'requests:create', 'requests:update', 'requests:submit', 'requests:cancel'
        ) LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (role_rec.id, perm_rec.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- Auditor gets read-only view
    FOR role_rec IN SELECT id, code FROM roles WHERE code = 'AUDITOR' LOOP
        FOR perm_rec IN SELECT id FROM permissions WHERE code IN (
            'stock:view', 'requests:view', 'approvals:view', 'approval_config:view'
        ) LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (role_rec.id, perm_rec.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 9. SEED DEFAULT 3-STAGE APPROVAL WORKFLOWS FOR EXISTING COMPANIES
DO $$
DECLARE
    comp_rec RECORD;
    wf_id UUID;
BEGIN
    FOR comp_rec IN SELECT id, name FROM companies LOOP
        IF NOT EXISTS (SELECT 1 FROM approval_workflows WHERE company_id = comp_rec.id AND request_type = 'ASSET_REQUEST') THEN
            INSERT INTO approval_workflows (company_id, name, request_type, description, is_active)
            VALUES (comp_rec.id, 'Standard 3-Tier Asset Approval', 'ASSET_REQUEST', 'Standard Department -> Asset Manager -> Company Admin workflow', true)
            RETURNING id INTO wf_id;

            INSERT INTO approval_workflow_steps (workflow_id, step_order, role_code, description, is_active) VALUES
                (wf_id, 1, 'DEPT_MANAGER', 'Department Head Authorization', true),
                (wf_id, 2, 'ASSET_MANAGER', 'Asset Custody & Stock Verification', true),
                (wf_id, 3, 'COMPANY_ADMIN', 'Executive Financial Approval', true);
        END IF;
    END LOOP;
END $$;

COMMIT;
