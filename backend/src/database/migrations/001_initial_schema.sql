-- ====================================================================
-- PANTONE FIXED ASSET MANAGEMENT SYSTEM - DATABASE SCHEMA (MIGRATION 001)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. COMPANIES (Multi-Tenant Master)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_companies_modtime
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branches_company_code UNIQUE (company_id, code)
);

CREATE TRIGGER update_branches_modtime
    BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    head_employee_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_departments_company_code UNIQUE (company_id, code)
);

CREATE TRIGGER update_departments_modtime
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. LOCATIONS
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    building VARCHAR(100) NOT NULL,
    floor VARCHAR(50),
    room_number VARCHAR(50),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_locations_modtime
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. ROLES (Supports global Common Admin role and company-specific roles)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_company_code UNIQUE (company_id, code)
);

-- Partial index for global system roles (where company_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_roles_code ON roles(code) WHERE company_id IS NULL;

-- 6. PERMISSIONS
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ROLE_PERMISSIONS
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 8. EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    designation VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employees_company_code UNIQUE (company_id, employee_code),
    CONSTRAINT uq_employees_company_email UNIQUE (company_id, email)
);

-- Deferred FK for department head
ALTER TABLE departments
    DROP CONSTRAINT IF EXISTS fk_departments_head_employee,
    ADD CONSTRAINT fk_departments_head_employee
    FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TRIGGER update_employees_modtime
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. USERS (Common Admin has company_id = NULL)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. USER_PERMISSIONS (Direct overrides)
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, permission_id)
);

-- 11. VENDORS
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_number VARCHAR(100),
    rating NUMERIC(3,2) DEFAULT 5.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendors_company_code UNIQUE (company_id, code)
);

CREATE TRIGGER update_vendors_modtime
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. ASSET_CATEGORIES
CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE',
    depreciation_rate_percent NUMERIC(5,2) DEFAULT 10.00,
    useful_life_months INT DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_company_code ON asset_categories(company_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_categories_code ON asset_categories(code) WHERE company_id IS NULL;

CREATE TRIGGER update_asset_categories_modtime
    BEFORE UPDATE ON asset_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. ASSETS (Central Asset Registry)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    qr_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    serial_number VARCHAR(100),
    model_number VARCHAR(100),
    manufacturer VARCHAR(100),
    purchase_date DATE,
    purchase_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    current_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    invoice_number VARCHAR(100),
    warranty_start DATE,
    warranty_end DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    condition VARCHAR(50) NOT NULL DEFAULT 'NEW',
    photo_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_asset_status CHECK (status IN (
        'AVAILABLE', 'IN_STOCK', 'ASSIGNED', 'UNDER_MAINTENANCE',
        'DAMAGED', 'LOST', 'RETURNED', 'TRANSFERRED', 'RETIRED', 'DISPOSED'
    )),
    CONSTRAINT chk_asset_condition CHECK (condition IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'
    ))
);

CREATE INDEX IF NOT EXISTS idx_assets_company ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_employee ON assets(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_qr ON assets(qr_code);

CREATE TRIGGER update_assets_modtime
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. ASSET_DOCUMENTS
CREATE TABLE IF NOT EXISTS asset_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. ASSET_PHOTOS
CREATE TABLE IF NOT EXISTS asset_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    photo_type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    caption TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. STOCK_ITEMS
CREATE TABLE IF NOT EXISTS stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100),
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_STOCK',
    received_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- 17. STOCK_MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_asset ON stock_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);

-- 18. ASSET_REQUESTS
CREATE TABLE IF NOT EXISTS asset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_code VARCHAR(50) UNIQUE NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
    specific_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_request_status CHECK (status IN (
        'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'
    )),
    CONSTRAINT chk_request_priority CHECK (priority IN (
        'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    ))
);

CREATE TRIGGER update_asset_requests_modtime
    BEFORE UPDATE ON asset_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 19. ASSET_REQUEST_APPROVALS
CREATE TABLE IF NOT EXISTS asset_request_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    step_number INT NOT NULL DEFAULT 1,
    decision VARCHAR(50) NOT NULL,
    comments TEXT,
    action_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. ASSET_ASSIGNMENTS
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    condition_at_assignment VARCHAR(50) NOT NULL DEFAULT 'GOOD',
    return_due_date DATE,
    remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON asset_assignments(employee_id);

-- 21. ASSET_RETURNS
CREATE TABLE IF NOT EXISTS asset_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_code VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES asset_assignments(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    returned_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    condition VARCHAR(50) NOT NULL,
    damage_description TEXT,
    damage_photo_url TEXT,
    destination_status VARCHAR(50) NOT NULL DEFAULT 'IN_STOCK',
    remarks TEXT
);

-- 22. MAINTENANCE_RECORDS
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_code VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    problem TEXT NOT NULL,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    technician_name VARCHAR(100),
    estimated_cost NUMERIC(15,2) DEFAULT 0.00,
    actual_cost NUMERIC(15,2) DEFAULT 0.00,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'REPORTED',
    description TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_maint_status CHECK (status IN (
        'REPORTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    ))
);

CREATE TRIGGER update_maintenance_records_modtime
    BEFORE UPDATE ON maintenance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 23. ASSET_TRANSFERS
CREATE TABLE IF NOT EXISTS asset_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_code VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    from_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    from_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    to_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    transfer_type VARCHAR(50) NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    condition VARCHAR(50) NOT NULL DEFAULT 'GOOD',
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transfer_type CHECK (transfer_type IN (
        'EMPLOYEE_TO_EMPLOYEE', 'DEPT_TO_DEPT', 'LOCATION_TO_LOCATION', 'INTER_COMPANY'
    )),
    CONSTRAINT chk_transfer_status CHECK (status IN (
        'INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING', 'COMPLETED', 'REJECTED'
    ))
);

CREATE TRIGGER update_asset_transfers_modtime
    BEFORE UPDATE ON asset_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 24. INTER_COMPANY_TRANSFERS
CREATE TABLE IF NOT EXISTS inter_company_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES asset_transfers(id) ON DELETE CASCADE UNIQUE,
    from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sending_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    receiving_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    originating_book_value NUMERIC(15,2) DEFAULT 0.00,
    transfer_fee NUMERIC(15,2) DEFAULT 0.00,
    dispatch_date TIMESTAMPTZ,
    receipt_date TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_RECEIPT',
    acknowledgement_notes TEXT,
    CONSTRAINT chk_inter_status CHECK (status IN (
        'PENDING_RECEIPT', 'CONFIRMED', 'DISPUTED'
    ))
);

-- 25. HANDOVER_RECORDS
CREATE TABLE IF NOT EXISTS handover_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    transfer_id UUID REFERENCES asset_transfers(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES asset_assignments(id) ON DELETE SET NULL,
    sender_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    receiver_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
    handover_time TIME NOT NULL DEFAULT CURRENT_TIME,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    condition VARCHAR(50) NOT NULL DEFAULT 'GOOD',
    remarks TEXT,
    sender_signature_svg TEXT,
    receiver_signature_svg TEXT,
    signature_hash VARCHAR(64),
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. ASSET_HISTORY (Immutable Event Ledger)
CREATE TABLE IF NOT EXISTS asset_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    from_state VARCHAR(50),
    to_state VARCHAR(50),
    entity_affected VARCHAR(100),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_company ON asset_history(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_time ON asset_history(timestamp);

-- 27. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    entity_type VARCHAR(50),
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- 28. AUDIT_LOGS (System-wide Audit Ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values_json JSONB,
    new_values_json JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 29. SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_settings_company_key ON system_settings(company_id, setting_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_system_settings_key ON system_settings(setting_key) WHERE company_id IS NULL;
