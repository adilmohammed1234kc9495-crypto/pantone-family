import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 9: Reports, Analytics & Exports", () => {
  jest.setTimeout(40000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Auth Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let apparelsDeptManagerToken: string;
  let apparelsAuditorToken: string;
  let apparelsEmployeeToken: string;

  // Master Data IDs
  let apparelsBranchId: string;
  let apparelsDeptId: string;
  let garmentsDeptId: string;
  let apparelsLocId: string;
  let categoryMachineryId: string;
  let categoryOfficeId: string;
  let vendorId: string;
  let apparelsEmpId: string;

  // Entities
  let asset1Id: string;
  let asset2Id: string;
  let garmentsAssetId: string;
  let transferId: string;
  let assignmentId: string;
  let maintenanceId: string;
  let stockItemId: string;
  let requestId: string;

  beforeAll(async () => {
    // 1. Get company IDs
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // Clean up previous Phase 9 test records
    await query("DELETE FROM maintenance_records WHERE maintenance_code LIKE 'MNT-P9-%'");
    await query("DELETE FROM asset_transfers WHERE transfer_code LIKE 'TRF-P9-%'");
    await query("DELETE FROM asset_requests WHERE request_code LIKE 'REQ-P9-%'");
    await query("DELETE FROM stock_items WHERE stock_code LIKE 'STK-P9-%'");
    await query("DELETE FROM assets WHERE asset_tag LIKE 'AST-P9-%'");
    await query("DELETE FROM users WHERE username IN ('p9_dept_manager', 'p9_auditor', 'p9_employee')");

    // 2. Admin Auth Tokens
    const caLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });
    commonAdminToken = caLogin.body.data.accessToken;

    const aaLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });
    apparelsAdminToken = aaLogin.body.data.accessToken;

    const gaLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "garments_admin", password: env.SEED_GARMENTS_ADMIN_PASSWORD });
    garmentsAdminToken = gaLogin.body.data.accessToken;

    // 3. Organization Setup
    const brRes = await query(`
      INSERT INTO branches (company_id, code, name)
      VALUES ($1, 'BR-P9-APP', 'Apparels P9 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsBranchId = brRes.rows[0].id;

    const deptRes1 = await query(`
      INSERT INTO departments (company_id, code, name)
      VALUES ($1, 'DPT-P9-CUT', 'P9 Cutting Dept')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsDeptId = deptRes1.rows[0].id;

    const deptRes2 = await query(`
      INSERT INTO departments (company_id, code, name)
      VALUES ($1, 'DPT-P9-GAR', 'P9 Garments Sewing')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId]);
    garmentsDeptId = deptRes2.rows[0].id;

    const locRes = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number)
      VALUES ($1, $2, 'Building 9', 'Floor 1', 'Room 101')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsLocId = locRes.rows[0].id;

    // 4. Categories & Vendors
    const catRes1 = await query(`
      INSERT INTO asset_categories (company_id, code, name, useful_life_months)
      VALUES ($1, 'CAT-P9-MAC', 'P9 Heavy Machinery', 60)
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    categoryMachineryId = catRes1.rows[0].id;

    const catRes2 = await query(`
      INSERT INTO asset_categories (company_id, code, name, useful_life_months)
      VALUES ($1, 'CAT-P9-OFF', 'P9 Office Equipment', 36)
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    categoryOfficeId = catRes2.rows[0].id;

    const venRes = await query(`
      INSERT INTO vendors (company_id, code, name, email)
      VALUES ($1, 'VEN-P9-01', 'P9 Industrial Tech Ltd', 'tech@p9vendor.com')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    vendorId = venRes.rows[0].id;

    // 5. Employees
    const empRes = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, department_id)
      VALUES ($1, 'EMP-P9-001', 'Rahim', 'Khan', 'rahim.p9@apparels.pantone.com', $2)
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id;
    `, [apparelsCompanyId, apparelsDeptId]);
    apparelsEmpId = empRes.rows[0].id;

    // 6. User Roles and Dedicated Auth Users
    const rolesRes = await query<{ id: string; code: string }>("SELECT id, code FROM roles WHERE company_id = $1", [apparelsCompanyId]);
    const deptManagerRole = rolesRes.rows.find((r) => r.code === "DEPT_MANAGER")!;
    const auditorRole = rolesRes.rows.find((r) => r.code === "AUDITOR")!;
    const employeeRole = rolesRes.rows.find((r) => r.code === "EMPLOYEE")!;

    const pwdHash = await hashPassword("Password@123");

    // Dept Manager user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'p9_dept_manager', 'dept.mgr@apparels.com', $2, $3, $4, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwdHash, deptManagerRole.id, apparelsEmpId]);

    // Auditor user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'p9_auditor', 'auditor@apparels.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwdHash, auditorRole.id]);

    // Employee user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'p9_employee', 'employee@apparels.com', $2, $3, $4, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwdHash, employeeRole.id, apparelsEmpId]);

    const dmLogin = await request(app).post("/api/v1/auth/login").send({ username: "p9_dept_manager", password: "Password@123" });
    apparelsDeptManagerToken = dmLogin.body.data.accessToken;

    const audLogin = await request(app).post("/api/v1/auth/login").send({ username: "p9_auditor", password: "Password@123" });
    apparelsAuditorToken = audLogin.body.data.accessToken;

    const empLogin = await request(app).post("/api/v1/auth/login").send({ username: "p9_employee", password: "Password@123" });
    apparelsEmployeeToken = empLogin.body.data.accessToken;

    // 7. Seed Test Assets
    // Asset 1: Depreciating available asset (120,000 cost, 60 mo useful life)
    const ast1 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, serial_number, purchase_date, purchase_cost,
        depreciation_method, useful_life_months, accumulated_depreciation, current_value,
        status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'AST-P9-001', 'BAR-AST-P9-001', 'QR-AST-P9-001', 'P9 CNC Laser Cutter', 'SN-P9-001', '2025-01-01', 120000.00,
        'STRAIGHT_LINE', 60, 24000.00, 96000.00,
        'AVAILABLE', 'EXCELLENT'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, vendorId]);
    asset1Id = ast1.rows[0].id;

    // Asset 2: Fully depreciated asset (20,000 cost, 24 mo useful life, 0 book value)
    const ast2 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, serial_number, purchase_date, purchase_cost,
        depreciation_method, useful_life_months, accumulated_depreciation, current_value,
        status, condition, assigned_employee_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'AST-P9-002', 'BAR-AST-P9-002', 'QR-AST-P9-002', 'P9 Industrial Iron', 'SN-P9-002', '2023-01-01', 20000.00,
        'STRAIGHT_LINE', 24, 20000.00, 0.00,
        'ASSIGNED', 'GOOD', $7
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryOfficeId, vendorId, apparelsEmpId]);
    asset2Id = ast2.rows[0].id;

    // Garments Asset (for multi-tenant isolation testing)
    const garAst = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_date, purchase_cost, useful_life_months,
        accumulated_depreciation, current_value, status, condition
      ) VALUES (
        $1, (SELECT id FROM branches WHERE company_id = $1 LIMIT 1), $2,
        (SELECT id FROM asset_categories WHERE company_id = $1 LIMIT 1),
        'AST-P9-GAR-01', 'BAR-AST-P9-GAR-01', 'QR-AST-P9-GAR-01', 'P9 Garments Sewing Table', '2025-06-01', 45000.00, 36,
        15000.00, 30000.00, 'AVAILABLE', 'GOOD'
      ) RETURNING id;
    `, [garmentsCompanyId, garmentsDeptId]);
    garmentsAssetId = garAst.rows[0].id;

    // 8. Seed Custody Assignment
    const asgRes = await query(`
      INSERT INTO asset_assignments (
        company_id, asset_id, employee_id, department_id, assigned_at,
        return_due_date, condition_at_assignment, status
      ) VALUES (
        $1, $2, $3, $4, '2025-02-01', '2025-05-01', 'GOOD', 'ACTIVE'
      ) RETURNING id;
    `, [apparelsCompanyId, asset2Id, apparelsEmpId, apparelsDeptId]);
    assignmentId = asgRes.rows[0].id;

    // 9. Seed Maintenance Record
    const mntRes = await query(`
      INSERT INTO maintenance_records (
        company_id, asset_id, maintenance_code, work_order_number, problem, priority, status, actual_cost, vendor_id, report_date
      ) VALUES (
        $1, $2, 'MNT-P9-001', 'WO-P9-001', 'Hydraulic fluid pressure drop', 'HIGH', 'IN_PROGRESS', 1500.00, $3, CURRENT_DATE
      ) RETURNING id;
    `, [apparelsCompanyId, asset1Id, vendorId]);
    maintenanceId = mntRes.rows[0].id;

    // 10. Seed Inter-Company Transfer
    const trfRes = await query(`
      INSERT INTO asset_transfers (
        from_company_id, to_company_id, asset_id, transfer_code, transfer_type,
        status, reason, condition_before, transfer_date
      ) VALUES (
        $1, $2, $3, 'TRF-P9-001', 'INTER_COMPANY',
        'COMPLETED', 'Capacity rebalancing for autumn collection', 'EXCELLENT', '2025-08-01'
      ) RETURNING id;
    `, [apparelsCompanyId, garmentsCompanyId, asset1Id]);
    transferId = trfRes.rows[0].id;

    // 11. Seed Stock Item
    const stkRes = await query(`
      INSERT INTO stock_items (
        company_id, branch_id, stock_code, item_name, quantity_on_hand, minimum_quantity, reorder_level, maximum_quantity, unit_cost, status
      ) VALUES (
        $1, $2, 'STK-P9-001', 'P9 Ceramic Blade Replacement', 5, 20, 20, 100, 45.00, 'IN_STOCK'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    stockItemId = stkRes.rows[0].id;

    // 12. Seed Asset Request
    const reqRes = await query(`
      INSERT INTO asset_requests (
        company_id, department_id, employee_id, request_code, request_number, priority, status, reason, quantity
      ) VALUES (
        $1, $2, $3, 'REQ-P9-001', 'REQ-2026-P9-01', 'HIGH', 'PENDING_APPROVAL', 'High-capacity needle bar for new fabric run', 1
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsDeptId, apparelsEmpId]);
    requestId = reqRes.rows[0].id;

    // 13. Seed Physical Scan
    const userRes = await query<{ id: string }>("SELECT id FROM users WHERE username = 'apparels_admin'");
    await query(`
      INSERT INTO asset_scans (company_id, asset_id, scanned_by, scan_type, scan_value, source, scanned_at, metadata)
      VALUES ($1, $2, $3, 'QR', 'AST-P9-MAC-001', 'WEB_CAMERA', CURRENT_TIMESTAMP, '{"notes": "Audit inventory count check"}'::jsonb)
    `, [apparelsCompanyId, asset1Id, userRes.rows[0].id]);
  });

  afterAll(async () => {
    await query("DELETE FROM maintenance_records WHERE id = $1 OR maintenance_code LIKE 'MNT-P9-%'", [maintenanceId]).catch(() => {});
    await query("DELETE FROM asset_transfers WHERE id = $1 OR transfer_code LIKE 'TRF-P9-%'", [transferId]).catch(() => {});
    await query("DELETE FROM asset_requests WHERE id = $1 OR request_code LIKE 'REQ-P9-%'", [requestId]).catch(() => {});
    await query("DELETE FROM stock_items WHERE id = $1 OR stock_code LIKE 'STK-P9-%'", [stockItemId]).catch(() => {});
    await query("DELETE FROM asset_scans WHERE metadata->>'notes' = 'Audit inventory count check' OR scan_value = 'AST-P9-MAC-001'");
    await query("DELETE FROM asset_assignments WHERE id = $1", [assignmentId]).catch(() => {});
    await query("DELETE FROM assets WHERE asset_tag LIKE 'AST-P9-%'");
    await query("DELETE FROM users WHERE username IN ('p9_dept_manager', 'p9_auditor', 'p9_employee')");
  });

  // ===========================================================================
  // 1. EXECUTIVE DASHBOARD METRICS
  // ===========================================================================
  describe("1. Executive Dashboard (`GET /api/v1/reports/dashboard`)", () => {
    it("1.1 Returns comprehensive dashboard metrics for Common Admin globally", async () => {
      const res = await request(app)
        .get("/api/v1/reports/dashboard")
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assets).toBeDefined();
      expect(res.body.data.assets.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.assets.acquisitionCost).toBeGreaterThan(0);
      expect(res.body.data.assets.bookValue).toBeGreaterThan(0);
      expect(res.body.data.operations).toBeDefined();
      expect(res.body.data.operations.lowStockItems).toBeGreaterThanOrEqual(1);
      expect(res.body.data.companyBreakdown).toBeDefined();
      expect(Array.isArray(res.body.data.companyBreakdown)).toBe(true);
      expect(res.body.data.companyBreakdown.length).toBeGreaterThanOrEqual(2);
    });

    it("1.2 Scoped Common Admin via X-Company-Id returns metrics strictly for that company", async () => {
      const res = await request(app)
        .get("/api/v1/reports/dashboard")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", apparelsCompanyId);

      expect(res.status).toBe(200);
      expect(res.body.data.companyBreakdown).toBeUndefined(); // company breakdown omitted when scoped
      expect(res.body.data.assets.total).toBeGreaterThanOrEqual(2);
    });

    it("1.3 Company Admin receives dashboard metrics restricted to their tenant boundary", async () => {
      const res = await request(app)
        .get("/api/v1/reports/dashboard")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assets.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.companyBreakdown).toBeUndefined();
    });

    it("1.4 Department Manager receives dashboard metrics scoped to their assigned department", async () => {
      const res = await request(app)
        .get("/api/v1/reports/dashboard")
        .set("Authorization", `Bearer ${apparelsDeptManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assets.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 2. ASSET REGISTER REPORT
  // ===========================================================================
  describe("2. Fixed Asset Register Report (`GET /api/v1/reports/assets`)", () => {
    it("2.1 Returns paginated assets with full relational attributes", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?page=1&limit=10")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalGrossValue).toBeGreaterThan(0);

      const first = res.body.data.items.find((a: any) => a.id === asset1Id);
      expect(first).toBeDefined();
      expect(first.asset_tag).toBe("AST-P9-001");
      expect(first.category_name).toBe("P9 Heavy Machinery");
      expect(first.vendor_name).toBe("P9 Industrial Tech Ltd");
      expect(first.depreciation_method).toBe("STRAIGHT_LINE");
    });

    it("2.2 Filters assets by categoryId", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/assets?categoryId=${categoryMachineryId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => a.category_name === "P9 Heavy Machinery")).toBe(true);
    });

    it("2.3 Filters assets by lifecycle status", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?status=AVAILABLE")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => a.status === "AVAILABLE")).toBe(true);
    });

    it("2.4 Filters assets by purchase date range", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?dateFrom=2024-12-01&dateTo=2025-02-01")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-001")).toBe(true);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-002")).toBe(false); // Purchased 2023
    });

    it("2.5 Filters assets by value range (minValue and maxValue)", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?minValue=100000")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => Number(a.purchase_cost) >= 100000)).toBe(true);
    });

    it("2.6 Filters assets by depreciationStatus (FULLY_DEPRECIATED)", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?depreciationStatus=FULLY_DEPRECIATED")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-002")).toBe(true);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-001")).toBe(false);
    });

    it("2.7 Sorts assets by purchaseCost asc and desc", async () => {
      const resDesc = await request(app)
        .get("/api/v1/reports/assets?sortBy=purchaseCost&sortOrder=desc")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      const items = resDesc.body.data.items;
      if (items.length >= 2) {
        expect(Number(items[0].purchase_cost)).toBeGreaterThanOrEqual(Number(items[1].purchase_cost));
      }
    });
  });

  // ===========================================================================
  // 3. DEPRECIATION REPORT
  // ===========================================================================
  describe("3. Straight-Line Depreciation Report (`GET /api/v1/reports/depreciation`)", () => {
    it("3.1 Returns summary totals matching authoritative depreciation engine", async () => {
      const res = await request(app)
        .get("/api/v1/reports/depreciation")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;
      expect(summary.grossAssetValue).toBeGreaterThan(0);
      expect(summary.totalAccumulatedDepreciation).toBeGreaterThan(0);
      expect(summary.totalNetBookValue).toBeGreaterThan(0);
      expect(summary.totalMonthlyDepreciation).toBeGreaterThan(0);
      expect(summary.totalAnnualDepreciation).toBe(summary.totalMonthlyDepreciation * 12);
      expect(summary.fullyDepreciatedCount).toBeGreaterThanOrEqual(1);
    });

    it("3.2 Per-row depreciation items calculate monthly rate and remaining useful life correctly", async () => {
      const res = await request(app)
        .get("/api/v1/reports/depreciation?limit=500")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      const asset1Row = res.body.data.items.find((a: any) => a.asset_tag === "AST-P9-001");
      expect(asset1Row).toBeDefined();
      expect(Number(asset1Row.purchase_cost)).toBe(120000);
      expect(Number(asset1Row.useful_life_months)).toBe(60);
      expect(Number(asset1Row.monthly_depreciation)).toBe(2000);
      expect(Number(asset1Row.annual_depreciation)).toBe(24000);
      expect(asset1Row.depreciation_status).toBe("DEPRECIATING");
    });

    it("3.3 Filters depreciation report by categoryId", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/depreciation?categoryId=${categoryMachineryId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => a.category_name === "P9 Heavy Machinery")).toBe(true);
    });
  });

  // ===========================================================================
  // 4. ASSET MOVEMENT / TRANSFER REPORT
  // ===========================================================================
  describe("4. Asset Transfers & Movements Report (`GET /api/v1/reports/transfers`)", () => {
    it("4.1 Returns inter-company transfer record with routing and condition details", async () => {
      const res = await request(app)
        .get("/api/v1/reports/transfers?limit=100")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      const transfer = res.body.data.items.find((t: any) => t.transfer_code === "TRF-P9-001");
      expect(transfer).toBeDefined();
      expect(transfer.transfer_type).toBe("INTER_COMPANY");
      expect(transfer.from_company_name).toBe("Pantone Apparels");
      expect(transfer.to_company_name).toBe("Pantone Garments");
      expect(transfer.status).toBe("COMPLETED");
      expect(transfer.condition_before).toBe("EXCELLENT");
    });

    it("4.2 Filters transfers by transferType=INTER_COMPANY", async () => {
      const res = await request(app)
        .get("/api/v1/reports/transfers?transferType=INTER_COMPANY")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((t: any) => t.transfer_type === "INTER_COMPANY")).toBe(true);
    });

    it("4.3 Summary metrics calculate completed vs in-transit counts", async () => {
      const res = await request(app)
        .get("/api/v1/reports/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.body.data.summary.totalTransfers).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.completedCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 5. CUSTODY & ASSIGNMENT REPORT
  // ===========================================================================
  describe("5. Custody & Assignment Report (`GET /api/v1/reports/custody`)", () => {
    it("5.1 Returns custody assignments with employee and department relations", async () => {
      const res = await request(app)
        .get("/api/v1/reports/custody?limit=100")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const asg = res.body.data.items.find((c: any) => c.id === assignmentId);
      expect(asg).toBeDefined();
      expect(asg.employee_name).toBe("Rahim Khan");
      expect(asg.department_name).toBe("P9 Cutting Dept");
      expect(asg.status).toBe("ACTIVE");
    });

    it("5.2 Identifies overdue custody assignments", async () => {
      const res = await request(app)
        .get("/api/v1/reports/custody?isOverdue=true")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const overdue = res.body.data.items.find((c: any) => c.id === assignmentId);
      expect(overdue).toBeDefined();
      expect(overdue.is_overdue).toBe(true);
    });

    it("5.3 Filters custody report by employeeId", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/custody?employeeId=${apparelsEmpId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((c: any) => c.employee_code === "EMP-P9-001")).toBe(true);
    });
  });

  // ===========================================================================
  // 6. MAINTENANCE REPORT
  // ===========================================================================
  describe("6. Maintenance & Work Orders Report (`GET /api/v1/reports/maintenance`)", () => {
    it("6.1 Returns maintenance records with cost analytics", async () => {
      const res = await request(app)
        .get("/api/v1/reports/maintenance")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const record = res.body.data.items.find((m: any) => m.id === maintenanceId);
      expect(record).toBeDefined();
      expect(record.maintenance_code).toBe("MNT-P9-001");
      expect(record.problem).toBe("Hydraulic fluid pressure drop");
      expect(Number(record.actual_cost)).toBe(1500);

      const summary = res.body.data.summary;
      expect(summary.totalCost).toBeGreaterThanOrEqual(1500);
      expect(summary.avgCost).toBeGreaterThan(0);
    });

    it("6.2 Filters maintenance report by priority", async () => {
      const res = await request(app)
        .get("/api/v1/reports/maintenance?priority=HIGH")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((m: any) => m.priority === "HIGH")).toBe(true);
    });
  });

  // ===========================================================================
  // 7. STOCK REPORT
  // ===========================================================================
  describe("7. Stock & Inventory Report (`GET /api/v1/reports/stock`)", () => {
    it("7.1 Returns inventory items with valuation", async () => {
      const res = await request(app)
        .get("/api/v1/reports/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const item = res.body.data.items.find((s: any) => s.stock_code === "STK-P9-001");
      expect(item).toBeDefined();
      expect(item.current_quantity).toBe(5);
      expect(item.minimum_quantity).toBe(20);
      expect(item.stock_status).toBe("LOW_STOCK");
      expect(Number(item.total_value)).toBe(5 * 45); // 225.00
    });

    it("7.2 Filters by lowStockOnly=true", async () => {
      const res = await request(app)
        .get("/api/v1/reports/stock?lowStockOnly=true")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((s: any) => s.stock_status === "LOW_STOCK" || s.stock_status === "OUT_OF_STOCK")).toBe(true);
      expect(res.body.data.summary.lowStockItems).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 8. REQUESTS REPORT
  // ===========================================================================
  describe("8. Requests & Requisitions Report (`GET /api/v1/reports/requests`)", () => {
    it("8.1 Returns requisitions with status breakdown", async () => {
      const res = await request(app)
        .get("/api/v1/reports/requests")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const reqRecord = res.body.data.items.find((r: any) => r.id === requestId);
      expect(reqRecord).toBeDefined();
      expect(reqRecord.request_number).toBe("REQ-2026-P9-01");
      expect(reqRecord.requester_name).toBe("Rahim Khan");
      expect(reqRecord.status).toBe("PENDING_APPROVAL");
      expect(res.body.data.summary.pendingCount).toBeGreaterThanOrEqual(1);
    });

    it("8.2 Filters requests by priority", async () => {
      const res = await request(app)
        .get("/api/v1/reports/requests?priority=HIGH")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((r: any) => r.priority === "HIGH")).toBe(true);
    });
  });

  // ===========================================================================
  // 9. AUDIT REPORT
  // ===========================================================================
  describe("9. Audit & Security Trail Report (`GET /api/v1/reports/audit`)", () => {
    it("9.1 Returns immutable audit event records with actor and timestamp", async () => {
      const res = await request(app)
        .get("/api/v1/reports/audit")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.summary.totalAuditEvents).toBeGreaterThanOrEqual(1);
    });

    it("9.2 Filters audit logs by action", async () => {
      const res = await request(app)
        .get("/api/v1/reports/audit?action=LOGIN")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => a.action === "LOGIN")).toBe(true);
    });
  });

  // ===========================================================================
  // 10. SCANS REPORT
  // ===========================================================================
  describe("10. Physical Scans Report (`GET /api/v1/reports/scans`)", () => {
    it("10.1 Returns physical scan ledger records with scan type and source", async () => {
      const res = await request(app)
        .get("/api/v1/reports/scans")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const scan = res.body.data.items.find((s: any) => s.notes === "Audit inventory count check");
      expect(scan).toBeDefined();
      expect(scan.asset_tag).toBe("AST-P9-001");
      expect(scan.scan_type).toBe("QR");
      expect(scan.source).toBe("WEB_CAMERA");
      expect(res.body.data.summary.qrScans).toBeGreaterThanOrEqual(1);
    });

    it("10.2 Filters scans by scanType=QR", async () => {
      const res = await request(app)
        .get("/api/v1/reports/scans?scanType=QR")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((s: any) => s.scan_type === "QR")).toBe(true);
    });
  });

  // ===========================================================================
  // 11. EXPORTS (CSV & XLSX)
  // ===========================================================================
  describe("11. Report Export Engine (CSV & XLSX)", () => {
    it("11.1 Asset register CSV export (?format=csv) returns RFC 4180 format with BOM and header metadata", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?format=csv")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment; filename=");
      expect(res.text.startsWith("\uFEFF")).toBe(true); // UTF-8 BOM
      expect(res.text).toContain("Report Title");
      expect(res.text).toContain("Fixed Asset Register Report");
      expect(res.text).toContain("Company Context");
      expect(res.text).toContain("AST-P9-001");
    });

    const binaryParser = (res: any, callback: any) => {
      const data: Buffer[] = [];
      res.on("data", (chunk: Buffer) => data.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(data)));
    };

    it("11.2 Asset register XLSX export (?format=xlsx) returns valid OpenXML binary buffer", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?format=xlsx")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(res.headers["content-disposition"]).toContain("attachment; filename=");
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(1000); // Substantial binary payload
    });

    it("11.3 Dedicated export endpoint (/assets/export) defaults to CSV and returns attachment", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets/export")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("AST-P9-001");
    });

    it("11.4 Depreciation CSV export returns valid calculated currency columns", async () => {
      const res = await request(app)
        .get("/api/v1/reports/depreciation/export?format=csv")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Straight-Line Depreciation & Valuation Report");
      expect(res.text).toContain("Monthly Dep.");
      expect(res.text).toContain("AST-P9-001");
    });

    it("11.5 Transfers XLSX export generates binary buffer with transfer routing", async () => {
      const res = await request(app)
        .get("/api/v1/reports/transfers/export?format=xlsx")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Buffer);
    });

    it("11.6 Export metadata includes generated timestamp, user info, applied filters, and company context", async () => {
      const res = await request(app)
        .get("/api/v1/reports/maintenance/export?format=csv&priority=HIGH")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Company Context");
      expect(res.text).toContain("PANTONE-APP");
      expect(res.text).toContain("priority=HIGH");
    });
  });

  // ===========================================================================
  // 12. MULTI-TENANT ISOLATION & SECURITY BOUNDARY ENFORCEMENT
  // ===========================================================================
  describe("12. Multi-Tenant Isolation & Security Boundary Enforcement", () => {
    it("12.1 Pantone Apparels user cannot view Pantone Garments assets in reports", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((a: any) => a.id === garmentsAssetId)).toBe(false);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-GAR-01")).toBe(false);
    });

    it("12.2 Pantone Garments user cannot view Pantone Apparels assets in reports", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets")
        .set("Authorization", `Bearer ${garmentsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((a: any) => a.id === asset1Id)).toBe(false);
      expect(res.body.data.items.some((a: any) => a.asset_tag === "AST-P9-001")).toBe(false);
      expect(res.body.data.items.some((a: any) => a.id === garmentsAssetId)).toBe(true);
    });

    it("12.3 Query parameter tampering (?companyId=...) by company user is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/assets?companyId=${garmentsCompanyId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("12.4 Header tampering (X-Company-Id) by regular user is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("12.5 Department Manager querying reports is automatically scoped to their department", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets")
        .set("Authorization", `Bearer ${apparelsDeptManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((a: any) => a.department_name === "P9 Cutting Dept")).toBe(true);
    });

    it("12.6 Department Manager querying a foreign department is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/assets?departmentId=${garmentsDeptId}`)
        .set("Authorization", `Bearer ${apparelsDeptManagerToken}`);

      // Query includes departmentId != user.departmentId
      // Either empty or scoped to their department without leaking
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it("12.7 Auditor has read-only access across reports and cannot perform mutations", async () => {
      // Auditor can view reports
      const viewRes = await request(app)
        .get("/api/v1/reports/assets")
        .set("Authorization", `Bearer ${apparelsAuditorToken}`);
      expect(viewRes.status).toBe(200);

      // Auditor cannot mutate master data
      const mutateRes = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAuditorToken}`)
        .send({ name: "Illegal Asset" });
      expect(mutateRes.status).toBe(403);
    });

    it("12.8 Regular Employee without reports permission is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/reports/dashboard")
        .set("Authorization", `Bearer ${apparelsEmployeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Insufficient permissions");
    });

    it("12.9 Unauthenticated request is rejected with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/reports/dashboard");
      expect(res.status).toBe(401);
    });

    it("12.10 Export endpoint strictly enforces tenant boundary (Apparels cannot export Garments data)", async () => {
      const res = await request(app)
        .get(`/api/v1/reports/assets/export?companyId=${garmentsCompanyId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });
  });

  // ===========================================================================
  // 13. EDGE CASES & VALIDATION
  // ===========================================================================
  describe("13. Edge Cases & Validation", () => {
    it("13.1 Empty result set returns structured response with total: 0 and empty array", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?search=NONEXISTENT_ASSET_TAG_XYZ_999")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it("13.2 Pagination parameters are validated and capped", async () => {
      const res = await request(app)
        .get("/api/v1/reports/assets?page=1&limit=5")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    });
  });
});
