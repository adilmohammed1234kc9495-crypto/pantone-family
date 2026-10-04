import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 8: QR / Barcode Identity & Physical Asset Scanning", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Auth Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let apparelsEmployeeToken: string;
  let apparelsAuditorToken: string;

  // Master Data IDs
  let apparelsBranchId: string;
  let garmentsBranchId: string;
  let apparelsDeptId: string;
  let garmentsDeptId: string;
  let apparelsLocId: string;
  let garmentsLocId: string;
  let categoryMachineryId: string;
  let apparelsEmpId: string;

  // Assets
  let assetAvailable: string;
  let assetAssigned: string;
  let assetMaintenance: string;
  let assetInTransit: string;
  let assetDamaged: string;
  let assetDisputed: string;
  let assetRetired: string;
  let garmentsAssetId: string;

  let assetAvailableTag: string;
  let assetAvailableBarcode: string;
  let assetAvailableQr: string;

  beforeAll(async () => {
    // 1. Get company IDs
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // Clean up previous test artifacts
    await query("DELETE FROM asset_scans WHERE company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM maintenance_records WHERE maintenance_code LIKE 'MNT-P8-%'");
    await query("DELETE FROM asset_transfers WHERE transfer_code LIKE 'TRF-P8-%'");

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

    // 3. Branches
    const br1 = await query(`
      INSERT INTO branches (company_id, code, name)
      VALUES ($1, 'BR-P8-APP', 'Apparels P8 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsBranchId = br1.rows[0].id;

    const br2 = await query(`
      INSERT INTO branches (company_id, code, name)
      VALUES ($1, 'BR-P8-GAR', 'Garments P8 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId]);
    garmentsBranchId = br2.rows[0].id;

    // 4. Departments
    const dep1 = await query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES ($1, $2, 'DEP-P8-APP', 'Apparels Scanning Hub')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsDeptId = dep1.rows[0].id;

    const dep2 = await query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES ($1, $2, 'DEP-P8-GAR', 'Garments Scanning Hub')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId]);
    garmentsDeptId = dep2.rows[0].id;

    // 5. Locations
    const loc1 = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number, description)
      VALUES ($1, $2, 'Terminal A', 'Level 1', 'Bay 10', 'Apparels Scan Dock')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsLocId = loc1.rows[0].id;

    const loc2 = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number, description)
      VALUES ($1, $2, 'Terminal G', 'Level 1', 'Bay 20', 'Garments Scan Dock')
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId]);
    garmentsLocId = loc2.rows[0].id;

    // 6. Category
    const cat = await query(`
      INSERT INTO asset_categories (company_id, code, name, useful_life_months, depreciation_method)
      VALUES ($1, 'CAT-P8-SCAN', 'Scanning Test Machinery', 60, 'STRAIGHT_LINE')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    categoryMachineryId = cat.rows[0].id;

    // 7. Employee
    const emp = await query(`
      INSERT INTO employees (company_id, branch_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, $3, 'EMP-P8-SCAN-01', 'Rahul', 'Sharma', 'rahul.scan@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId]);
    apparelsEmpId = emp.rows[0].id;

    // 8. Custom Users: Employee & Auditor
    const pwHash = await hashPassword("SecureP8#2026!");
    const empRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId])).rows[0].id;
    const auditorRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId])).rows[0].id;

    // Create Employee user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'p8_emp_user', 'p8_emp@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = $2, role_id = $3
      RETURNING id;
    `, [apparelsCompanyId, pwHash, empRole]);

    // Create Auditor user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'p8_auditor_user', 'p8_auditor@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = $2, role_id = $3
      RETURNING id;
    `, [apparelsCompanyId, pwHash, auditorRole]);

    const el = await request(app).post("/api/v1/auth/login").send({ username: "p8_emp_user", password: "SecureP8#2026!" });
    apparelsEmployeeToken = el.body.data.accessToken;

    const al = await request(app).post("/api/v1/auth/login").send({ username: "p8_auditor_user", password: "SecureP8#2026!" });
    apparelsAuditorToken = al.body.data.accessToken;

    // 9. Assets Setup across various lifecycle states
    // Asset 1: AVAILABLE
    assetAvailableTag = `AST-P8-APP-AVAIL-${Date.now().toString().slice(-6)}`;
    assetAvailableBarcode = `BAR-${assetAvailableTag}`;
    assetAvailableQr = `QR-${assetAvailableTag}`;
    const a1 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Available Loom Cutter', 12000.00, 10000.00, 'AVAILABLE', 'EXCELLENT', 'SN-P8-001')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, assetAvailableTag, assetAvailableBarcode, assetAvailableQr]);
    assetAvailable = a1.rows[0].id;

    // Asset 2: ASSIGNED
    const a2Tag = `AST-P8-APP-ASGN-${Date.now().toString().slice(-6)}`;
    const a2 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, assigned_employee_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Assigned Fabric Inspector', 8500.00, 7000.00, 'ASSIGNED', 'GOOD', 'SN-P8-002')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, apparelsEmpId, categoryMachineryId, a2Tag, `BAR-${a2Tag}`, `QR-${a2Tag}`]);
    assetAssigned = a2.rows[0].id;

    // Asset 3: UNDER_MAINTENANCE
    const a3Tag = `AST-P8-APP-MAINT-${Date.now().toString().slice(-6)}`;
    const a3 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Motor Under Overhaul', 15000.00, 9000.00, 'UNDER_MAINTENANCE', 'FAIR', 'SN-P8-003')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, a3Tag, `BAR-${a3Tag}`, `QR-${a3Tag}`]);
    assetMaintenance = a3.rows[0].id;

    // Create a maintenance record for asset 3
    const mntCode = `MNT-P8-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await query(`
      INSERT INTO maintenance_records (
        maintenance_code, asset_id, company_id, maintenance_type, status, priority, problem, description
      ) VALUES ($1, $2, $3, 'CORRECTIVE', 'IN_PROGRESS', 'HIGH', 'Hydraulic Motor Repair', 'Replacing pump valve');
    `, [mntCode, assetMaintenance, apparelsCompanyId]);

    // Asset 4: IN_TRANSIT (Inter-Company Transfer: Apparels -> Garments)
    const a4Tag = `AST-P8-APP-TRF-${Date.now().toString().slice(-6)}`;
    const a4 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'In-Transit Steam Press', 25000.00, 18000.00, 'IN_TRANSIT', 'GOOD', 'SN-P8-004')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, a4Tag, `BAR-${a4Tag}`, `QR-${a4Tag}`]);
    assetInTransit = a4.rows[0].id;

    // Create inter-company transfer record
    const trfCode = `TRF-P8-INT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await query(`
      INSERT INTO asset_transfers (
        asset_id, transfer_code, transfer_type, status, from_company_id, to_company_id,
        requested_by, dispatch_date, reason
      ) VALUES ($1, $2, 'INTER_COMPANY', 'DISPATCHED', $3, $4, (SELECT id FROM users WHERE username = 'apparels_admin'), NOW(), 'Factory reallocation')
      RETURNING id;
    `, [assetInTransit, trfCode, apparelsCompanyId, garmentsCompanyId]);

    // Asset 5: DAMAGED
    const a5Tag = `AST-P8-APP-DMG-${Date.now().toString().slice(-6)}`;
    const a5 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Damaged Spindle Arm', 6000.00, 2000.00, 'DAMAGED', 'DAMAGED', 'SN-P8-005')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, a5Tag, `BAR-${a5Tag}`, `QR-${a5Tag}`]);
    assetDamaged = a5.rows[0].id;

    // Asset 6: DISPUTED
    const a6Tag = `AST-P8-APP-DISP-${Date.now().toString().slice(-6)}`;
    const a6 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Disputed Dye Machine', 30000.00, 22000.00, 'DISPUTED', 'FAIR', 'SN-P8-006')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, a6Tag, `BAR-${a6Tag}`, `QR-${a6Tag}`]);
    assetDisputed = a6.rows[0].id;

    // Asset 7: RETIRED
    const a7Tag = `AST-P8-APP-RET-${Date.now().toString().slice(-6)}`;
    const a7 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Decommissioned Boiler', 50000.00, 0.00, 'RETIRED', 'UNUSABLE', 'SN-P8-007')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryMachineryId, a7Tag, `BAR-${a7Tag}`, `QR-${a7Tag}`]);
    assetRetired = a7.rows[0].id;

    // Garments Asset (for Tenant Isolation testing)
    const garCat = await query(`
      INSERT INTO asset_categories (company_id, code, name, useful_life_months, depreciation_method)
      VALUES ($1, 'CAT-P8-GAR', 'Garments Machinery', 60, 'STRAIGHT_LINE')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId]);
    const garTag = `AST-P8-GAR-001-${Date.now().toString().slice(-6)}`;
    const ga = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Garments Knitting Unit', 18000.00, 14000.00, 'AVAILABLE', 'EXCELLENT', 'SN-P8-GAR-001')
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId, garmentsDeptId, garmentsLocId, garCat.rows[0].id, garTag, `BAR-${garTag}`, `QR-${garTag}`]);
    garmentsAssetId = ga.rows[0].id;
  });

  // =========================================================================
  // 1. QR IDENTITY GENERATION & CANONICAL RESOLUTION
  // =========================================================================
  describe("1. QR Identity & Canonical Resolution", () => {
    it("1.1 GET /api/v1/assets/:id/qr generates scannable QR with canonical asset:{uuid} payload and SVG", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${assetAvailable}/qr`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canonicalPayload).toBe(`asset:${assetAvailable}`);
      expect(res.body.data.token).toBe(`asset:${assetAvailable}`);
      expect(res.body.data.svg).toContain("<svg");
      expect(res.body.data.dataUrl).toContain("data:image/png;base64,");
    });

    it("1.2 GET /api/v1/scan/assets/:token resolves canonical asset:{uuid} to correct asset", async () => {
      const canonicalToken = `asset:${assetAvailable}`;
      const res = await request(app)
        .get(`/api/v1/scan/assets/${canonicalToken}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assetId).toBe(assetAvailable);
      expect(res.body.data.assetTag).toBe(assetAvailableTag);
      expect(res.body.data.name).toBe("Available Loom Cutter");
      expect(res.body.data.company.code).toBe("PANTONE-APP");
      expect(res.body.data.status).toBe("AVAILABLE");
    });

    it("1.3 GET /api/v1/scan/assets/:token resolves raw UUID token", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/${assetAvailable}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assetId).toBe(assetAvailable);
    });

    it("1.4 POST /api/v1/scan/resolve resolves asset via JSON body payload", async () => {
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          code: `asset:${assetAvailable}`,
          scanType: "QR",
          source: "WEB_CAMERA"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assetId).toBe(assetAvailable);
      expect(res.body.data.valuation.purchaseCost).toBe(12000);
    });

    it("1.5 POST /api/v1/assets/:id/qr/regenerate updates visual QR code without changing asset UUID or tag", async () => {
      const beforeAsset = await query("SELECT qr_code, asset_tag, purchase_cost, id FROM assets WHERE id = $1", [assetAvailable]);

      const res = await request(app)
        .post(`/api/v1/assets/${assetAvailable}/qr/regenerate`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canonicalPayload).toBe(`asset:${assetAvailable}`);

      const afterAsset = await query("SELECT qr_code, asset_tag, purchase_cost, id FROM assets WHERE id = $1", [assetAvailable]);
      expect(afterAsset.rows[0].id).toBe(beforeAsset.rows[0].id);
      expect(afterAsset.rows[0].asset_tag).toBe(beforeAsset.rows[0].asset_tag);
      expect(afterAsset.rows[0].purchase_cost).toBe(beforeAsset.rows[0].purchase_cost);
      expect(afterAsset.rows[0].qr_code).not.toBe(beforeAsset.rows[0].qr_code);
    });

    it("1.6 Non-existent asset token returns 404 Not Found", async () => {
      const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${nonExistentUuid}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("1.7 Empty or malformed token body returns validation error", async () => {
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ code: "" });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. CODE 128 BARCODE GENERATION & RESOLUTION
  // =========================================================================
  describe("2. Code 128 Barcode Generation & Resolution", () => {
    it("2.1 GET /api/v1/assets/:id/barcode generates Code 128 vector SVG and DataURL", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${assetAvailable}/barcode`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(assetAvailableTag);
      expect(res.body.data.svg).toContain("<svg");
      expect(res.body.data.svg).toContain(assetAvailableTag);
      expect(res.body.data.dataUrl).toContain("data:image/svg+xml;base64,");
    });

    it("2.2 POST /api/v1/scan/resolve resolves linear barcode string to correct asset", async () => {
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          code: assetAvailableTag,
          scanType: "BARCODE",
          source: "HARDWARE_SCANNER"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assetId).toBe(assetAvailable);
      expect(res.body.data.assetTag).toBe(assetAvailableTag);
    });

    it("2.3 Resolving BAR- prefixed barcode value also resolves to the asset", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/${assetAvailableBarcode}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assetId).toBe(assetAvailable);
    });
  });

  // =========================================================================
  // 3. MULTI-TENANT ISOLATION & SECURITY
  // =========================================================================
  describe("3. Multi-Tenant Isolation & Security", () => {
    it("3.1 Apparels user scanning Garments asset QR is blocked with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("3.2 Garments user scanning Apparels asset barcode is blocked with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          code: assetAvailableTag,
          scanType: "BARCODE"
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("3.3 Common Admin can resolve assets across any company globally", async () => {
      const resApp = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAvailable}`)
        .set("Authorization", `Bearer ${commonAdminToken}`);
      expect(resApp.status).toBe(200);
      expect(resApp.body.data.company.code).toBe("PANTONE-APP");

      const resGar = await request(app)
        .get(`/api/v1/scan/assets/asset:${garmentsAssetId}`)
        .set("Authorization", `Bearer ${commonAdminToken}`);
      expect(resGar.status).toBe(200);
      expect(resGar.body.data.company.code).toBe("PANTONE-GAR");
    });

    it("3.4 Common Admin scoped via X-Company-Id enforces boundary of specified tenant", async () => {
      // Scoped to Apparels: Apparels asset succeeds, Garments asset fails
      const resAllowed = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAvailable}`)
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", apparelsCompanyId);
      expect(resAllowed.status).toBe(200);

      const resBlocked = await request(app)
        .get(`/api/v1/scan/assets/asset:${garmentsAssetId}`)
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", apparelsCompanyId);
      expect(resBlocked.status).toBe(403);
    });

    it("3.5 Regular user attempting X-Company-Id header tampering is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(403);
    });

    it("3.6 Unauthenticated request is rejected with 401 Unauthorized", async () => {
      const res = await request(app).get(`/api/v1/scan/assets/asset:${assetAvailable}`);
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 4. CONTEXT-AWARE OPERATIONAL ACTION ENGINE
  // =========================================================================
  describe("4. Context-Aware Operational Action Engine", () => {
    it("4.1 AVAILABLE asset returns [view, assign, transfer, maintenance] actions", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAvailable}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("assign");
      expect(actionKeys).toContain("transfer");
      expect(actionKeys).toContain("maintenance");
    });

    it("4.2 ASSIGNED asset returns [view, custody, return, transfer] actions", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAssigned}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("custody");
      expect(actionKeys).toContain("return");
      expect(actionKeys).toContain("transfer");
      expect(actionKeys).not.toContain("assign");
    });

    it("4.3 UNDER_MAINTENANCE asset returns [view, work_order, update_maintenance] actions", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetMaintenance}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.maintenanceState.isUnderMaintenance).toBe(true);
      expect(res.body.data.maintenanceState.activeWorkOrders).toBeGreaterThanOrEqual(1);

      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("work_order");
      expect(actionKeys).toContain("update_maintenance");
      expect(actionKeys).not.toContain("assign");
      expect(actionKeys).not.toContain("transfer");
    });

    it("4.4 IN_TRANSIT asset scanned by Destination Admin returns [view, transfer_details, confirm_receipt, dispute]", async () => {
      // Destination is Garments
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetInTransit}`)
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(200);
      expect(res.body.data.transferState.isInTransit).toBe(true);

      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("transfer_details");
      expect(actionKeys).toContain("confirm_receipt");
      expect(actionKeys).toContain("dispute");
    });

    it("4.5 IN_TRANSIT asset scanned by Sending Admin omits confirm_receipt (Anti-Self-Clearance Rule)", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetInTransit}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("transfer_details");
      expect(actionKeys).not.toContain("confirm_receipt"); // Sending company cannot self-confirm receipt!
    });

    it("4.6 DAMAGED asset returns [view, damage_inspection, resolve_damage] actions", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetDamaged}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("damage_inspection");
      expect(actionKeys).toContain("resolve_damage");
      expect(actionKeys).not.toContain("assign");
    });

    it("4.7 DISPUTED asset returns [view, dispute_details, resolve_dispute] actions", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetDisputed}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).toContain("dispute_details");
      expect(actionKeys).toContain("resolve_dispute");
    });

    it("4.8 RETIRED asset returns strictly read-only [view] action", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetRetired}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toEqual(["view"]);
    });

    it("4.9 AUDITOR role scanning asset returns strictly read-only [view] action across all states", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAvailable}`)
        .set("Authorization", `Bearer ${apparelsAuditorToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toEqual(["view"]);
    });

    it("4.10 EMPLOYEE role receives view and assign but cannot perform administrative transfers", async () => {
      const res = await request(app)
        .get(`/api/v1/scan/assets/asset:${assetAvailable}`)
        .set("Authorization", `Bearer ${apparelsEmployeeToken}`);

      expect(res.status).toBe(200);
      const actionKeys = res.body.data.allowedActions.map((a: { action: string }) => a.action);
      expect(actionKeys).toContain("view");
      expect(actionKeys).not.toContain("transfer");
      expect(actionKeys).not.toContain("maintenance");
    });
  });

  // =========================================================================
  // 5. SCAN EVENT LEDGER & AUDIT HISTORY
  // =========================================================================
  describe("5. Scan Event Ledger & Audit History", () => {
    it("5.1 Successful scan creates record in asset_scans and ASSET_SCAN_SUCCESS audit log", async () => {
      const scanRes = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          code: `asset:${assetAvailable}`,
          scanType: "QR",
          source: "WEB_CAMERA"
        });

      expect(scanRes.status).toBe(200);

      // Verify asset_scans row
      const scanRows = await query(
        "SELECT * FROM asset_scans WHERE asset_id = $1 ORDER BY scanned_at DESC LIMIT 1",
        [assetAvailable]
      );
      expect(scanRows.rows.length).toBe(1);
      expect(scanRows.rows[0].scan_type).toBe("QR");
      expect(scanRows.rows[0].source).toBe("WEB_CAMERA");
      expect(scanRows.rows[0].is_success).toBe(true);

      // Verify audit log
      const auditRows = await query(
        "SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'ASSET_SCAN_SUCCESS' ORDER BY timestamp DESC LIMIT 1",
        [assetAvailable]
      );
      expect(auditRows.rows.length).toBe(1);
      expect(auditRows.rows[0].action).toBe("ASSET_SCAN_SUCCESS");
    });

    it("5.2 Cross-company failed scan logs ASSET_SCAN_FAILED without leaking asset metadata", async () => {
      await request(app)
        .get(`/api/v1/scan/assets/asset:${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      const auditRows = await query(
        "SELECT * FROM audit_logs WHERE company_id = $1 AND action = 'ASSET_SCAN_FAILED' ORDER BY timestamp DESC LIMIT 1",
        [apparelsCompanyId]
      );
      expect(auditRows.rows.length).toBe(1);
      expect(auditRows.rows[0].new_values_json.reason).toContain("Cross-company unauthorized scan");
    });

    it("5.3 GET /api/v1/assets/:id/scans returns physical scan history for asset", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${assetAvailable}/scans`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].asset_id).toBe(assetAvailable);
    });

    it("5.4 GET /api/v1/scans returns paginated scan history scoped to authorized company", async () => {
      const res = await request(app)
        .get("/api/v1/scans?page=1&limit=10")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

      // Verify all returned scans belong strictly to Apparels
      for (const s of res.body.data) {
        expect(s.company_id).toBe(apparelsCompanyId);
      }
    });
  });

  // =========================================================================
  // 6. PRINTABLE ASSET LABELS & BULK GENERATION
  // =========================================================================
  describe("6. Printable Asset Labels & Bulk Generation", () => {
    it("6.1 POST /api/v1/assets/:id/labels/print returns complete printable label with QR & Barcode", async () => {
      const res = await request(app)
        .post(`/api/v1/assets/${assetAvailable}/labels/print`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assetId).toBe(assetAvailable);
      expect(res.body.data.assetTag).toBe(assetAvailableTag);
      expect(res.body.data.companyName).toBe("Pantone Apparels");
      expect(res.body.data.qrSvg).toContain("<svg");
      expect(res.body.data.barcodeSvg).toContain("<svg");
      expect(res.body.data.qrDataUrl).toContain("data:image/png;base64,");
      expect(res.body.data.barcodeDataUrl).toContain("data:image/svg+xml;base64,");

      // Verify audit log
      const audit = await query(
        "SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'ASSET_LABEL_PRINTED' ORDER BY timestamp DESC LIMIT 1",
        [assetAvailable]
      );
      expect(audit.rows.length).toBe(1);
    });

    it("6.2 POST /api/v1/assets/labels/batch generates batch printable label dataset", async () => {
      const res = await request(app)
        .post("/api/v1/assets/labels/batch")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetIds: [assetAvailable, assetAssigned, assetMaintenance]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].assetTag).toBe(assetAvailableTag);
      expect(res.body.data[1].qrSvg).toContain("<svg");
      expect(res.body.data[2].barcodeSvg).toContain("<svg");
    });

    it("6.3 Cross-company label print attempt is strictly rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .post(`/api/v1/assets/${garmentsAssetId}/labels/print`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
    });

    it("6.4 Non-existent asset label print throws 404 Not Found", async () => {
      const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .post(`/api/v1/assets/${nonExistentUuid}/labels/print`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
