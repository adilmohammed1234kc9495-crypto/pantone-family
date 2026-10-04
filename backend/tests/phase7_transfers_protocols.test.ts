import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 7: Asset Transfers, Inter-Company Transfers & Dual-Authorization Protocols", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let apparelsDeptMgrToken: string;
  let apparelsEmployeeToken: string;
  let unauthorizedToken: string;

  // Master Data IDs
  let apparelsBranchId: string;
  let garmentsBranchId: string;
  let apparelsDeptId1: string;
  let apparelsDeptId2: string;
  let apparelsLocId1: string;
  let apparelsLocId2: string;
  let garmentsDeptId: string;
  let garmentsLocId: string;
  let apparelsEmpId1: string;
  let apparelsEmpId2: string;
  let garmentsEmpId1: string;
  let categoryMachineryId: string;

  // Assets
  let assetInternal1: string;
  let assetInternal2: string;
  let assetInterCompany1: string;
  let assetDispute1: string;
  let assetMaintenanceLocked: string;
  let interCompanyTransferId: string;

  beforeAll(async () => {
    // 1. Get companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // Clean up Phase 7 tables
    await query("DELETE FROM handover_records");
    await query("DELETE FROM inter_company_transfers");
    await query("DELETE FROM asset_transfers WHERE from_company_id IN ($1, $2) OR to_company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);

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
      VALUES ($1, 'BR-P7-APP', 'Apparels P7 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsBranchId = br1.rows[0].id;

    const br2 = await query(`
      INSERT INTO branches (company_id, code, name)
      VALUES ($1, 'BR-P7-GAR', 'Garments P7 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId]);
    garmentsBranchId = br2.rows[0].id;

    // 4. Departments
    const dep1 = await query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES ($1, $2, 'DEP-P7-APP-1', 'Apparels Assembly')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsDeptId1 = dep1.rows[0].id;

    const dep2 = await query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES ($1, $2, 'DEP-P7-APP-2', 'Apparels Finishing')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsDeptId2 = dep2.rows[0].id;

    const dep3 = await query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES ($1, $2, 'DEP-P7-GAR-1', 'Garments Weaving')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId]);
    garmentsDeptId = dep3.rows[0].id;

    // 5. Locations
    const loc1 = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number, description)
      VALUES ($1, $2, 'Building A', 'Floor 1', 'Bay 1', 'Assembly Floor Bay 1')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsLocId1 = loc1.rows[0].id;

    const loc2 = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number, description)
      VALUES ($1, $2, 'Building A', 'Floor 2', 'Bay 2', 'Finishing Floor Bay 2')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsLocId2 = loc2.rows[0].id;

    const loc3 = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number, description)
      VALUES ($1, $2, 'Building G', 'Floor 1', 'Bay 1', 'Garments Main Warehouse')
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId]);
    garmentsLocId = loc3.rows[0].id;

    // 6. Employees
    const emp1 = await query(`
      INSERT INTO employees (company_id, branch_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, $3, 'EMP-P7-APP-01', 'Dev', 'Patel', 'dev.patel@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1]);
    apparelsEmpId1 = emp1.rows[0].id;

    const emp2 = await query(`
      INSERT INTO employees (company_id, branch_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, $3, 'EMP-P7-APP-02', 'Kiran', 'Rao', 'kiran.rao@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId2]);
    apparelsEmpId2 = emp2.rows[0].id;

    const emp3 = await query(`
      INSERT INTO employees (company_id, branch_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, $3, 'EMP-P7-GAR-01', 'Salim', 'Khan', 'salim.khan@pantone-garments.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET status = 'ACTIVE'
      RETURNING id;
    `, [garmentsCompanyId, garmentsBranchId, garmentsDeptId]);
    garmentsEmpId1 = emp3.rows[0].id;

    // 7. Roles & Permissions setup
    const pwHash = await hashPassword("SecureP7#2026!");
    const assetMgrRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'ASSET_MANAGER'", [apparelsCompanyId])).rows[0].id;
    const deptMgrRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'DEPT_MANAGER'", [apparelsCompanyId])).rows[0].id;
    const empRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId])).rows[0].id;
    const garEmpRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [garmentsCompanyId])).rows[0].id;

    // Assign Phase 7 permissions
    const transferPerms = await query("SELECT id, code FROM permissions WHERE code LIKE 'transfers:%'");
    for (const p of transferPerms.rows) {
      // Asset manager gets all transfer permissions
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [assetMgrRole, p.id]);
      if (p.code === "transfers:view" || p.code === "transfers:create" || p.code === "transfers:approve") {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [deptMgrRole, p.id]);
      }
      if (p.code === "transfers:view") {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [empRole, p.id]);
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [garEmpRole, p.id]);
      }
    }

    // Test Users
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p7_asset_mgr', 'asset_mgr_p7@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwHash, assetMgrRole]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p7_dept_mgr', 'dept_mgr_p7@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwHash, deptMgrRole]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p7_emp', 'emp_p7@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id;
    `, [apparelsCompanyId, pwHash, empRole, apparelsEmpId1]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p7_gar_emp', 'gar_emp_p7@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id;
    `, [garmentsCompanyId, pwHash, garEmpRole, garmentsEmpId1]);

    // Auditor user (has transfers:view, but lacks transfers:create)
    const audRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId])).rows[0].id;
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p7_aud', 'aud_p7@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwHash, audRole]);

    // Token logins
    apparelsDeptMgrToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p7_dept_mgr", password: "SecureP7#2026!" })).body.data.accessToken;
    apparelsEmployeeToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p7_emp", password: "SecureP7#2026!" })).body.data.accessToken;
    const audLogin = await request(app).post("/api/v1/auth/login").send({ username: "user_p7_aud", password: "SecureP7#2026!" });
    unauthorizedToken = audLogin.body.data.accessToken;

    // 8. Category
    const catRes = await query("SELECT id FROM asset_categories WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    categoryMachineryId = catRes.rows[0].id;

    // Clean up old test assets if any
    await query("DELETE FROM assets WHERE asset_tag LIKE 'AST-P7-TRF-%'");

    // 9. Create Test Assets
    const a1 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition, assigned_employee_id
      ) VALUES (
        $1, $2, $3, $4, $5, 'AST-P7-TRF-001', 'BAR-P7-TRF-001', 'QR-P7-TRF-001', 'CNC Laser Cutter #1', 25000.00, 22000.00, 'ASSIGNED', 'GOOD', $6
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1, apparelsLocId1, categoryMachineryId, apparelsEmpId1]);
    assetInternal1 = a1.rows[0].id;

    const a2 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, 'AST-P7-TRF-002', 'BAR-P7-TRF-002', 'QR-P7-TRF-002', 'High-Speed Stitcher #2', 15000.00, 14000.00, 'AVAILABLE', 'EXCELLENT'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1, apparelsLocId1, categoryMachineryId]);
    assetInternal2 = a2.rows[0].id;

    const a3 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, 'AST-P7-TRF-003', 'BAR-P7-TRF-003', 'QR-P7-TRF-003', 'Industrial Steam Presser #3', 45000.00, 40000.00, 'AVAILABLE', 'GOOD'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1, apparelsLocId1, categoryMachineryId]);
    assetInterCompany1 = a3.rows[0].id;

    const a4 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, 'AST-P7-TRF-004', 'BAR-P7-TRF-004', 'QR-P7-TRF-004', 'Embroidery Loom #4', 35000.00, 30000.00, 'AVAILABLE', 'GOOD'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1, apparelsLocId1, categoryMachineryId]);
    assetDispute1 = a4.rows[0].id;

    const a5 = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id,
        asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, 'AST-P7-TRF-005', 'BAR-P7-TRF-005', 'QR-P7-TRF-005', 'Maintenance Locked Asset', 10000.00, 8000.00, 'UNDER_MAINTENANCE', 'FAIR'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId1, apparelsLocId1, categoryMachineryId]);
    assetMaintenanceLocked = a5.rows[0].id;
  });

  describe("Section 1: Internal Transfers (Employee, Department, Location)", () => {
    it("1.1 should initiate an employee-to-employee transfer within the same company", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal1,
          transferType: "EMPLOYEE_TO_EMPLOYEE",
          toEmployeeId: apparelsEmpId2,
          reason: "Project reassignment to finishing line",
          conditionBefore: "GOOD"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.transfer_code).toMatch(/^TRF-\d{8}-\d{4}$/);
      expect(res.body.data.status).toBe("INITIATED");
      expect(res.body.data.from_employee_id).toBe(apparelsEmpId1);
      expect(res.body.data.to_employee_id).toBe(apparelsEmpId2);
    });

    it("1.2 should reject transfer when destination employee is already the current custodian", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal1,
          transferType: "EMPLOYEE_TO_EMPLOYEE",
          toEmployeeId: apparelsEmpId1,
          reason: "Duplicate assignment attempt"
        });

      // Will fail with 409 (active transfer already exists) or 400 (already custodian)
      expect([400, 409]).toContain(res.status);
    });

    it("1.3 should reject internal employee transfer if destination employee belongs to different company", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "EMPLOYEE_TO_EMPLOYEE",
          toEmployeeId: garmentsEmpId1,
          reason: "Illegal cross-tenant internal transfer"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/different company/i);
    });

    it("1.4 should reject transfer if asset already has an active pending transfer", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal1,
          transferType: "DEPT_TO_DEPT",
          toDepartmentId: apparelsDeptId2,
          reason: "Conflicting transfer attempt"
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already part of an active transfer/i);
    });

    it("1.5 should reject transfer if asset is UNDER_MAINTENANCE", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetMaintenanceLocked,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocId2,
          reason: "Attempt to transfer broken asset"
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/UNDER_MAINTENANCE/i);
    });

    it("1.6 should reject unauthorized user attempting to initiate transfer without permission", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${unauthorizedToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocId2,
          reason: "Unauthorized attempt"
        });

      expect(res.status).toBe(403);
    });

    it("1.7 should reject department transfer if destination department belongs to different company", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "DEPT_TO_DEPT",
          toDepartmentId: garmentsDeptId,
          reason: "Cross company department transfer attempt"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/different company/i);
    });

    it("1.8 should reject location transfer if destination location belongs to different company", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: garmentsLocId,
          reason: "Cross company location transfer attempt"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/different company/i);
    });
  });

  describe("Section 2: Transfer State Machine & Physical Handover", () => {
    let testTransferId: string;

    beforeAll(async () => {
      // Create fresh transfer for state machine testing
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "DEPT_TO_DEPT",
          toDepartmentId: apparelsDeptId2,
          toLocationId: apparelsLocId2,
          reason: "Departmental relocation to finishing line",
          conditionBefore: "EXCELLENT"
        });
      testTransferId = res.body.data.id;
    });

    it("2.1 should reject dispatching before approval", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/dispatch`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Must be APPROVED/i);
    });

    it("2.2 should approve the transfer", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/approve`)
        .set("Authorization", `Bearer ${apparelsDeptMgrToken}`)
        .send({ remarks: "Approved for finishing department" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("APPROVED");
      expect(res.body.data.approved_by).toBeDefined();
    });

    it("2.3 should dispatch the transfer and move asset status to IN_TRANSIT", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/dispatch`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("DISPATCHED");
      expect(res.body.data.dispatch_date).toBeDefined();

      // Check asset status in database
      const assetRes = await query("SELECT status FROM assets WHERE id = $1", [assetInternal2]);
      expect(assetRes.rows[0].status).toBe("IN_TRANSIT");
    });

    it("2.4 should reject cancellation once transfer is in DISPATCHED state", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/cancel`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ reason: "Attempt to cancel dispatched item" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already been dispatched/i);
    });

    it("2.5 should confirm receipt, record handover, and update asset department/location", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/receive`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          conditionAfter: "EXCELLENT",
          destinationDepartmentId: apparelsDeptId2,
          destinationLocationId: apparelsLocId2,
          acknowledgementNotes: "Asset verified and accepted at finishing floor"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data.actual_delivery_date).toBeDefined();

      // Verify asset updated
      const assetRes = await query("SELECT status, department_id, location_id, condition FROM assets WHERE id = $1", [assetInternal2]);
      expect(assetRes.rows[0].status).toBe("AVAILABLE");
      expect(assetRes.rows[0].department_id).toBe(apparelsDeptId2);
      expect(assetRes.rows[0].location_id).toBe(apparelsLocId2);
      expect(assetRes.rows[0].condition).toBe("EXCELLENT");
    });
  });

  describe("Section 3: Cancellation Workflow", () => {
    it("3.1 should allow cancelling a transfer before dispatch and restore asset state", async () => {
      // Create transfer
      const createRes = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocId1,
          reason: "Test cancellation"
        });
      const trfId = createRes.body.data.id;

      // Cancel
      const cancelRes = await request(app)
        .post(`/api/v1/transfers/${trfId}/cancel`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ reason: "Operations plans changed" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe("CANCELLED");

      // Verify asset can now be transferred again
      const nextRes = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocId1,
          reason: "Subsequent transfer after cancellation"
        });
      expect(nextRes.status).toBe(201);

      // Clean up by cancelling it
      await request(app)
        .post(`/api/v1/transfers/${nextRes.body.data.id}/cancel`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ reason: "Clean up" });
    });
  });

  describe("Section 4: Inter-Company Transfers & Dual-Authorization Protocol", () => {
    it("4.1 should initiate an inter-company transfer from Apparels to Garments", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInterCompany1,
          transferType: "INTER_COMPANY",
          toCompanyId: garmentsCompanyId,
          reason: "Production capacity expansion at Garments unit",
          transferFee: 500.00,
          expectedDeliveryDate: "2026-10-15T00:00:00Z",
          conditionBefore: "GOOD"
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transfer_type).toBe("INTER_COMPANY");
      expect(res.body.data.from_company_id).toBe(apparelsCompanyId);
      expect(res.body.data.to_company_id).toBe(garmentsCompanyId);
      expect(res.body.data.inter_company).toBeDefined();
      expect(res.body.data.inter_company.status).toBe("INITIATED");

      interCompanyTransferId = res.body.data.id;
    });

    it("4.2 should approve and dispatch by sending company (Apparels)", async () => {
      // Approve
      const appRes = await request(app)
        .post(`/api/v1/transfers/${interCompanyTransferId}/approve`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ remarks: "Export approved by Apparels Admin" });
      expect(appRes.status).toBe(200);
      expect(appRes.body.data.status).toBe("APPROVED");

      // Dispatch
      const dispRes = await request(app)
        .post(`/api/v1/transfers/${interCompanyTransferId}/dispatch`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});
      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.status).toBe("DISPATCHED");
      expect(dispRes.body.data.inter_company.status).toBe("PENDING_RECEIPT");

      // Verify asset in transit
      const assetRes = await query("SELECT status FROM assets WHERE id = $1", [assetInterCompany1]);
      expect(assetRes.rows[0].status).toBe("IN_TRANSIT");
    });

    it("4.3 [DUAL AUTH VIOLATION] sending company admin MUST be strictly forbidden from confirming receipt", async () => {
      // Apparels admin tries to confirm receipt of their own dispatched transfer
      const res = await request(app)
        .post(`/api/v1/transfers/${interCompanyTransferId}/receive`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          conditionAfter: "GOOD",
          acknowledgementNotes: "Apparels self-clear attempt"
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Dual authorization violation.*destination company/i);
    });

    it("4.4 [DUAL AUTH PASS & ATOMIC RE-HOMING] destination company admin (Garments) confirms receipt", async () => {
      // Garments admin confirms receipt and re-homes asset
      const res = await request(app)
        .post(`/api/v1/transfers/${interCompanyTransferId}/receive`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          conditionAfter: "GOOD",
          destinationBranchId: garmentsBranchId,
          destinationDepartmentId: garmentsDeptId,
          destinationLocationId: garmentsLocId,
          destinationEmployeeId: garmentsEmpId1,
          acknowledgementNotes: "Received, inspected, and accepted into Garments inventory",
          signatureToken: "SIG-GAR-VERIFIED-7788"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data.inter_company.status).toBe("CONFIRMED");
      expect(res.body.data.inter_company.receiving_admin_id).toBeDefined();

      // Verify ATOMIC RE-HOMING: Asset company_id moved from Apparels to Garments!
      const assetRes = await query(`
        SELECT company_id, branch_id, department_id, location_id, assigned_employee_id, status
        FROM assets
        WHERE id = $1;
      `, [assetInterCompany1]);

      expect(assetRes.rows[0].company_id).toBe(garmentsCompanyId);
      expect(assetRes.rows[0].branch_id).toBe(garmentsBranchId);
      expect(assetRes.rows[0].department_id).toBe(garmentsDeptId);
      expect(assetRes.rows[0].location_id).toBe(garmentsLocId);
      expect(assetRes.rows[0].assigned_employee_id).toBe(garmentsEmpId1);
      expect(assetRes.rows[0].status).toBe("ASSIGNED");

      // Verify audit logs exist for both companies
      const appAudit = await query("SELECT id FROM audit_logs WHERE company_id = $1 AND action = 'TRANSFER_COMPLETED'", [apparelsCompanyId]);
      const garAudit = await query("SELECT id FROM audit_logs WHERE company_id = $1 AND action = 'TRANSFER_COMPLETED'", [garmentsCompanyId]);
      expect(appAudit.rows.length).toBeGreaterThan(0);
      expect(garAudit.rows.length).toBeGreaterThan(0);
    });

    it("4.5 should verify physical handover record was generated upon receipt of inter-company transfer", async () => {
      const hoRes = await query("SELECT * FROM handover_records WHERE transfer_id = $1", [interCompanyTransferId]);
      expect(hoRes.rows.length).toBe(1);
      expect(hoRes.rows[0].receiver_id).toBe(garmentsEmpId1);
      expect(hoRes.rows[0].digital_signature_token).toBe("SIG-GAR-VERIFIED-7788");
      expect(hoRes.rows[0].verification_notes).toMatch(/accepted under Transfer/i);
    });

    it("4.6 should reject inter-company transfer if destination company is the same company", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetDispute1,
          transferType: "INTER_COMPANY",
          toCompanyId: apparelsCompanyId,
          reason: "Invalid self-transfer"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be a different company/i);
    });

    it("4.7 should reject inter-company transfer initiation by standard employee", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsEmployeeToken}`)
        .send({
          assetId: assetDispute1,
          transferType: "INTER_COMPANY",
          toCompanyId: garmentsCompanyId,
          reason: "Unauthorized inter-company transfer"
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only Company Administrators or Asset Managers/i);
    });
  });

  describe("Section 5: Dispute Protocol & Common Admin Arbitration", () => {
    let disputedTransferId: string;

    beforeAll(async () => {
      // Initiate transfer from Apparels to Garments
      const trfRes = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetDispute1,
          transferType: "INTER_COMPANY",
          toCompanyId: garmentsCompanyId,
          reason: "Asset deployment for export contract"
        });
      disputedTransferId = trfRes.body.data.id;

      // Approve & Dispatch
      await request(app)
        .post(`/api/v1/transfers/${disputedTransferId}/approve`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});

      await request(app)
        .post(`/api/v1/transfers/${disputedTransferId}/dispatch`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});
    });

    it("5.1 should dispute an arriving transfer when damage or mismatch is discovered by destination admin", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${disputedTransferId}/dispute`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          reason: "Discovered severe motor crack and missing calibration cables on arrival"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("DISPUTED");
      expect(res.body.data.dispute_reason).toMatch(/severe motor crack/i);

      // Verify asset status changed to DISPUTED
      const assetRes = await query("SELECT status FROM assets WHERE id = $1", [assetDispute1]);
      expect(assetRes.rows[0].status).toBe("DISPUTED");
    });

    it("5.2 sending admin cannot clear dispute on destination side", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${disputedTransferId}/receive`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ conditionAfter: "GOOD" });

      expect(res.status).toBe(400); // Bad status: Cannot receive in DISPUTED status
    });

    it("5.3 Common Admin has global oversight and can arbitrate disputed transfer", async () => {
      // Common Admin views the disputed transfer
      const viewRes = await request(app)
        .get(`/api/v1/transfers/${disputedTransferId}`)
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.status).toBe("DISPUTED");

      // Common Admin can list transfers across all companies
      const listRes = await request(app)
        .get("/api/v1/transfers")
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.transfers.length).toBeGreaterThan(0);
    });

    it("5.4 should reject disputing an already completed transfer", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${interCompanyTransferId}/dispute`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({ reason: "Late dispute attempt" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot dispute transfer in status 'COMPLETED'/i);
    });

    it("5.5 should reject dispute without mandatory reason", async () => {
      // Create a transfer in DISPATCHED state to test missing dispute reason
      const createRes = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: assetInternal2,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocId1,
          reason: "Testing dispute validation"
        });
      const tId = createRes.body.data.id;
      await request(app).post(`/api/v1/transfers/${tId}/approve`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({});
      await request(app).post(`/api/v1/transfers/${tId}/dispatch`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({});

      const res = await request(app)
        .post(`/api/v1/transfers/${tId}/dispute`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ reason: "" });

      expect([400, 422]).toContain(res.status);
      expect(res.body.message).toMatch(/Mandatory dispute reason is required/i);
    });
  });

  describe("Section 6: Querying, Filtering & Asset Transfers History", () => {
    it("6.1 should filter transfers by status", async () => {
      const res = await request(app)
        .get("/api/v1/transfers?status=COMPLETED")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.transfers)).toBe(true);
      for (const t of res.body.data.transfers) {
        expect(t.status).toBe("COMPLETED");
      }
    });

    it("6.2 should filter transfers by transferType", async () => {
      const res = await request(app)
        .get("/api/v1/transfers?transferType=INTER_COMPANY")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      for (const t of res.body.data.transfers) {
        expect(t.transfer_type).toBe("INTER_COMPANY");
      }
    });

    it("6.3 should get asset transfers history via /api/v1/assets/:id/transfers", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${assetInterCompany1}/transfers`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].asset_id).toBe(assetInterCompany1);
    });

    it("6.4 tenant boundary isolation: Garments cannot view Apparels internal transfer", async () => {
      // Find an internal Apparels-only transfer
      const trfRes = await query("SELECT id FROM asset_transfers WHERE from_company_id = $1 AND to_company_id = $1 LIMIT 1", [apparelsCompanyId]);
      if (trfRes.rows.length > 0) {
        const trfId = trfRes.rows[0].id;
        const res = await request(app)
          .get(`/api/v1/transfers/${trfId}`)
          .set("Authorization", `Bearer ${garmentsAdminToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Cross-company violation/i);
      }
    });

    it("6.5 should search transfers by query term", async () => {
      const res = await request(app)
        .get("/api/v1/transfers?search=CNC")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transfers.length).toBeGreaterThan(0);
    });

    it("6.6 should support pagination limits", async () => {
      const res = await request(app)
        .get("/api/v1/transfers?limit=2&page=1")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transfers.length).toBeLessThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThan(0);
    });
  });
});
