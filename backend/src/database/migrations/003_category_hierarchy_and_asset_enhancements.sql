-- ====================================================================
-- PANTONE FIXED ASSET MANAGEMENT SYSTEM - DATABASE SCHEMA (MIGRATION 003)
-- Category Hierarchy, Asset Enhancements & Master Data Performance Indexes
-- ====================================================================

-- 1. Extend ASSET_CATEGORIES to support recursive hierarchy
ALTER TABLE asset_categories
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES asset_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_asset_categories_parent ON asset_categories(parent_id);

-- 2. Extend ASSETS to support explicit / overridden depreciation parameters
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE',
    ADD COLUMN IF NOT EXISTS depreciation_rate_percent NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS useful_life_months INT,
    ADD COLUMN IF NOT EXISTS depreciation_start_date DATE,
    ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) DEFAULT 0.00;

-- 3. Optimization indexes for multi-tenant and relational queries
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_branch ON departments(branch_id);
CREATE INDEX IF NOT EXISTS idx_locations_company ON locations(company_id);
CREATE INDEX IF NOT EXISTS idx_locations_branch ON locations(branch_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);

CREATE INDEX IF NOT EXISTS idx_assets_branch ON assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_vendor ON assets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number);
