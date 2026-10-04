-- ====================================================================
-- PANTONE FIXED ASSET MANAGEMENT SYSTEM - DATABASE SCHEMA (MIGRATION 004)
-- Asset Custody, Assignment, Returns, Damage Inspection & Maintenance
-- ====================================================================

-- 1. ASSET_ASSIGNMENTS ENHANCEMENTS
ALTER TABLE asset_assignments
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS handed_over_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS handover_condition VARCHAR(50),
    ADD COLUMN IF NOT EXISTS handover_remarks TEXT,
    ADD COLUMN IF NOT EXISTS handover_signature_ref TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assignment_status') THEN
        ALTER TABLE asset_assignments
            ADD CONSTRAINT chk_assignment_status CHECK (status IN ('ACTIVE', 'RETURNED', 'CANCELLED'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_active_custody ON asset_assignments(asset_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_assignments_company ON asset_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON asset_assignments(status);

-- 2. ASSET_RETURNS ENHANCEMENTS
ALTER TABLE asset_returns
    ADD COLUMN IF NOT EXISTS return_reason VARCHAR(100),
    ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_INSPECTION',
    ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS missing_accessories TEXT,
    ADD COLUMN IF NOT EXISTS missing_components TEXT,
    ADD COLUMN IF NOT EXISTS functional_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_return_inspection_status') THEN
        ALTER TABLE asset_returns
            ADD CONSTRAINT chk_return_inspection_status CHECK (inspection_status IN ('PENDING_INSPECTION', 'PASSED', 'MAINTENANCE_REQUIRED', 'DAMAGE_REVIEW'));
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_asset_returns_modtime ON asset_returns;
CREATE TRIGGER update_asset_returns_modtime
    BEFORE UPDATE ON asset_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_asset_returns_inspection_status ON asset_returns(inspection_status);
CREATE INDEX IF NOT EXISTS idx_asset_returns_company ON asset_returns(company_id);

-- 3. DAMAGE_INSPECTIONS (Structured Damage Assessment)
CREATE TABLE IF NOT EXISTS damage_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_code VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    return_id UUID REFERENCES asset_returns(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    damage_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    estimated_repair_cost NUMERIC(15,2) DEFAULT 0.00,
    recommendation VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_DECISION',
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_damage_severity CHECK (severity IN ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL')),
    CONSTRAINT chk_damage_recommendation CHECK (recommendation IN ('REPAIR', 'REPLACE_PARTS', 'SCRAP_RECOMMENDED', 'INSURANCE_CLAIM')),
    CONSTRAINT chk_damage_status CHECK (status IN ('PENDING_DECISION', 'APPROVED_FOR_REPAIR', 'ESCALATED_DISPOSAL', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_damage_inspections_asset ON damage_inspections(asset_id);
CREATE INDEX IF NOT EXISTS idx_damage_inspections_company ON damage_inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_damage_inspections_status ON damage_inspections(status);

DROP TRIGGER IF EXISTS update_damage_inspections_modtime ON damage_inspections;
CREATE TRIGGER update_damage_inspections_modtime
    BEFORE UPDATE ON damage_inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. MAINTENANCE_RECORDS ENHANCEMENTS (Work Order Lifecycle)
ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS chk_maint_status;
ALTER TABLE maintenance_records ADD CONSTRAINT chk_maint_status CHECK (
    status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED', 'REPORTED', 'APPROVED')
);

ALTER TABLE maintenance_records ALTER COLUMN status SET DEFAULT 'OPEN';

ALTER TABLE maintenance_records
    ADD COLUMN IF NOT EXISTS maintenance_type VARCHAR(50) NOT NULL DEFAULT 'CORRECTIVE',
    ADD COLUMN IF NOT EXISTS priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN IF NOT EXISTS work_order_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS invoice_reference VARCHAR(100),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES damage_inspections(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_maint_type') THEN
        ALTER TABLE maintenance_records
            ADD CONSTRAINT chk_maint_type CHECK (maintenance_type IN ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'CALIBRATION', 'UPGRADE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_maint_priority') THEN
        ALTER TABLE maintenance_records
            ADD CONSTRAINT chk_maint_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maint_work_order ON maintenance_records(work_order_number);
CREATE INDEX IF NOT EXISTS idx_maint_company ON maintenance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_records(status);
