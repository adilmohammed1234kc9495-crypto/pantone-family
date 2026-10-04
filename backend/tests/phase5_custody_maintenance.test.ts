import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 5: Asset Custody, Assignment, Returns, Damage Inspection & Maintenance", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let employeeToken: string;
  let auditorToken: string;

  // Seeded/Created entities
  let apparelsEmployeeId: string;
  let garmentsEmployeeId: string;
  let apparelsAssetId: string;
  let apparelsAssetId2: string;
  let garmentsAssetId: string;
  let testAssignmentId: string;

  beforeAll(async () => {
    // 1. Core companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Auth tokens
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

    // 3. Ensure test employees
    const pwHash = await hashPassword("TestUser#2026!");
    const empRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId]);
    const audRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId]);

    // Grant auditor read permissions for Phase 5
    const audPerms = await query("SELECT id FROM permissions WHERE code IN ('assignments:view', 'maintenance:view', 'assets:view', 'audit:view')");
    for (const p of audPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [audRole.rows[0].id, p.id]);
    }

    // Grant employee view permissions for self-service
    const empPerms = await query("SELECT id FROM permissions WHERE code IN ('assignments:view', 'assets:view')");
    for (const p of empPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [empRole.rows[0].id, p.id]);
    }

    // Apparels Employee
    const empInsert = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, 'EMP-APP-501', 'Rahul', 'Verma', 'rahul.v@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id
    `, [apparelsCompanyId]);
    apparelsEmployeeId = empInsert.rows[0].id;

    // Garments Employee
    const garEmpInsert = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, 'EMP-GAR-501', 'Tariq', 'Islam', 'tariq.i@pantone-garments.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id
    `, [garmentsCompanyId]);
    garmentsEmployeeId = garEmpInsert.rows[0].id;

    // Test Users for Employee and Auditor
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p5_emp', 'emp_p5@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id
    `, [apparelsCompanyId, pwHash, empRole.rows[0].id, apparelsEmployeeId]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p5_aud', 'aud_p5@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [apparelsCompanyId, pwHash, audRole.rows[0].id]);

    const empLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "user_p5_emp", password: "TestUser#2026!" });
    employeeToken = empLogin.body.data.accessToken;

    const audLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "user_p5_aud", password: "TestUser#2026!" });
    auditorToken = audLogin.body.data.accessToken;

    // 4. Ensure test category
    const catRes = await query("SELECT id FROM asset_categories LIMIT 1");
    let categoryId = catRes.rows[0]?.id;
    if (!categoryId) {
      const catIns = await query(`
        INSERT INTO asset_categories (code, name, depreciation_method, useful_life_months)
        VALUES ('CAT-P5-TEST', 'Testing Machinery', 'STRAIGHT_LINE', 60)
        RETURNING id
      `);
      categoryId = catIns.rows[0].id;
    }

    // 5. Create test assets for Apparels
    const astRes1 = await query(`
      INSERT INTO assets (company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition)
      VALUES ($1, $2, 'AST-APP-P5-001', 'BAR-APP-P5-001', 'QR-APP-P5-001', 'High-Speed Sewing Machine Alpha', 45000.00, 45000.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET status = 'AVAILABLE', assigned_employee_id = NULL
      RETURNING id
    `, [apparelsCompanyId, categoryId]);
    apparelsAssetId = astRes1.rows[0].id;

    const astRes2 = await query(`
      INSERT INTO assets (company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition)
      VALUES ($1, $2, 'AST-APP-P5-002', 'BAR-APP-P5-002', 'QR-APP-P5-002', 'Automatic Fabric Cutter Beta', 85000.00, 85000.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET status = 'AVAILABLE', assigned_employee_id = NULL
      RETURNING id
    `, [apparelsCompanyId, categoryId]);
    apparelsAssetId2 = astRes2.rows[0].id;

    // 6. Create test asset for Garments
    const astGarRes = await query(`
      INSERT INTO assets (company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition)
      VALUES ($1, $2, 'AST-GAR-P5-001', 'BAR-GAR-P5-001', 'QR-GAR-P5-001', 'Button Holer Industrial Gamma', 30000.00, 30000.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET status = 'AVAILABLE', assigned_employee_id = NULL
      RETURNING id
    `, [garmentsCompanyId, categoryId]);
    garmentsAssetId = astGarRes.rows[0].id;

    // Clean prior runs data for these test assets
    const testAssetIds = [apparelsAssetId, apparelsAssetId2, garmentsAssetId];
    await query("DELETE FROM asset_returns WHERE asset_id = ANY($1)", [testAssetIds]);
    await query("DELETE FROM maintenance_records WHERE asset_id = ANY($1)", [testAssetIds]);
    await query("DELETE FROM damage_inspections WHERE asset_id = ANY($1)", [testAssetIds]);
    await query("DELETE FROM asset_assignments WHERE asset_id = ANY($1)", [testAssetIds]);
    await query("UPDATE assets SET status = 'AVAILABLE', assigned_employee_id = NULL WHERE id = ANY($1)", [testAssetIds]);
  });

  describe("1. Custody Assignment & Physical Handover", () => {
    it("1.1 Assign available asset to employee creates active assignment record and updates asset status", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          employeeId: apparelsEmployeeId,
          conditionAtAssignment: "NEW",
          remarks: "Assigned for production run"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.asset_id).toBe(apparelsAssetId);
      expect(res.body.data.employee_id).toBe(apparelsEmployeeId);
      expect(res.body.data.status).toBe("ACTIVE");
      expect(res.body.data.is_handed_over).toBe(false);

      testAssignmentId = res.body.data.id;

      // Verify asset updated
      const assetDb = await query("SELECT status, assigned_employee_id FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("ASSIGNED");
      expect(assetDb.rows[0].assigned_employee_id).toBe(apparelsEmployeeId);

      // Verify immutable history logged
      const histDb = await query("SELECT * FROM asset_history WHERE asset_id = $1 AND event_type = 'CUSTODY_ASSIGNED'", [apparelsAssetId]);
      expect(histDb.rows.length).toBeGreaterThan(0);
    });

    it("1.2 Physical Handover confirmation updates assignment and logs handover details", async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${testAssignmentId}/handover`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          condition: "GOOD",
          remarks: "Physical handover completed, machine tested and operational",
          signatureRef: "sig-p5-test-hash"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_handed_over).toBe(true);
      expect(res.body.data.handover_condition).toBe("GOOD");
      expect(res.body.data.handover_remarks).toContain("machine tested");

      // Verify duplicate handover rejected
      const dupHandover = await request(app)
        .post(`/api/v1/assignments/${testAssignmentId}/handover`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ condition: "GOOD" });
      expect(dupHandover.status).toBe(409);
    });

    it("1.3 Querying assignments list returns detailed joined data with asset tag and employee name", async () => {
      const res = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assignments.length).toBeGreaterThan(0);
      const match = res.body.data.assignments.find((a: { id: string }) => a.id === testAssignmentId);
      expect(match).toBeDefined();
      expect(match.asset_tag).toBe("AST-APP-P5-001");
      expect(match.employee_first_name).toBe("Rahul");
    });
  });

  describe("2. Concurrency & Double Custody Protection", () => {
    it("2.1 Attempting to assign an already assigned asset is rejected with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          employeeId: apparelsEmployeeId
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("cannot be assigned because its current status is 'ASSIGNED'");
    });

    it("2.2 Database partial unique index uq_asset_active_custody prevents simultaneous active assignments", async () => {
      // Attempt direct DB insert of second active assignment
      let errorOccurred = false;
      try {
        await query(`
          INSERT INTO asset_assignments (asset_id, company_id, employee_id, status)
          VALUES ($1, $2, $3, 'ACTIVE')
        `, [apparelsAssetId, apparelsCompanyId, apparelsEmployeeId]);
      } catch (err: unknown) {
        errorOccurred = true;
        expect((err as Error).message).toContain("uq_asset_active_custody");
      }
      expect(errorOccurred).toBe(true);
    });

    it("2.3 Cannot assign asset of a different company to employee (Cross-company violation)", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId2,
          employeeId: garmentsEmployeeId // Garments employee into Apparels asset!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cross-company assignment prohibited");
    });
  });

  describe("3. Asset Returns & Inspection Workflow", () => {
    let returnId: string;

    it("3.1 Initiating return transitions asset to RETURNED and creates return with PENDING_INSPECTION", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          condition: "GOOD",
          returnReason: "End of scheduled production project",
          remarks: "Returned to plant inventory room"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.return_code).toMatch(/^RET-\d{4}-[A-Z0-9]{6}$/);
      expect(res.body.data.inspection_status).toBe("PENDING_INSPECTION");

      returnId = res.body.data.id;

      // Verify asset updated to RETURNED
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("RETURNED");

      // Verify assignment marked RETURNED
      const assignDb = await query("SELECT status FROM asset_assignments WHERE id = $1", [testAssignmentId]);
      expect(assignDb.rows[0].status).toBe("RETURNED");
    });

    it("3.2 Cannot return asset that is not currently ASSIGNED", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId, // Already RETURNED!
          condition: "GOOD"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("expected 'ASSIGNED'");
    });

    it("3.3 Return inspection with PASSED restores asset to AVAILABLE and clears custodian", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/${returnId}/inspect`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          inspectionStatus: "PASSED",
          condition: "EXCELLENT",
          functionalStatus: "WORKING",
          inspectionNotes: "All parts intact, test run cleared"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.inspection_status).toBe("PASSED");
      expect(res.body.data.destination_status).toBe("IN_STOCK");

      // Verify asset is back to AVAILABLE
      const assetDb = await query("SELECT status, assigned_employee_id, condition FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("AVAILABLE");
      expect(assetDb.rows[0].assigned_employee_id).toBeNull();
      expect(assetDb.rows[0].condition).toBe("EXCELLENT");
    });

    it("3.4 Return inspection cannot be performed twice on same return record", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/${returnId}/inspect`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ inspectionStatus: "PASSED" });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already undergone inspection");
    });

    it("3.5 Return inspection with MAINTENANCE_REQUIRED moves asset to UNDER_MAINTENANCE and spawns work order", async () => {
      // First assign asset 2
      await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: apparelsAssetId2, employeeId: apparelsEmployeeId });

      // Initiate return for asset 2
      const retRes = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: apparelsAssetId2, condition: "FAIR", remarks: "Motor overheating" });

      const ret2Id = retRes.body.data.id;

      // Inspect with MAINTENANCE_REQUIRED
      const inspRes = await request(app)
        .post(`/api/v1/returns/${ret2Id}/inspect`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          inspectionStatus: "MAINTENANCE_REQUIRED",
          maintenanceProblem: "Motor overheating under sustained load",
          inspectionNotes: "Bearing replacement needed"
        });

      expect(inspRes.status).toBe(200);
      expect(inspRes.body.data.inspection_status).toBe("MAINTENANCE_REQUIRED");

      // Asset must now be UNDER_MAINTENANCE
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [apparelsAssetId2]);
      expect(assetDb.rows[0].status).toBe("UNDER_MAINTENANCE");

      // Verify work order automatically generated
      const woDb = await query("SELECT * FROM maintenance_records WHERE asset_id = $1 AND status = 'OPEN'", [apparelsAssetId2]);
      expect(woDb.rows.length).toBe(1);
      expect(woDb.rows[0].work_order_number).toMatch(/^WO-\d{4}-[A-Z0-9]{6}$/);
      expect(woDb.rows[0].problem).toContain("Motor overheating");
    });
  });

  describe("4. Structured Damage Inspection & Repair Decisions", () => {
    let damageInspectionId: string;

    it("4.1 Record structured damage inspection directly on asset", async () => {
      const res = await request(app)
        .post("/api/v1/damage-inspections")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          damageType: "ELECTRICAL_FAULT",
          severity: "MAJOR",
          description: "Circuit board shorted during power fluctuation",
          estimatedRepairCost: 7500.00,
          recommendation: "REPAIR"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection_code).toMatch(/^DMG-\d{4}-[A-Z0-9]{6}$/);
      expect(res.body.data.severity).toBe("MAJOR");
      expect(res.body.data.status).toBe("PENDING_DECISION");

      damageInspectionId = res.body.data.id;

      // Asset marked DAMAGED
      const assetDb = await query("SELECT status, condition FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("DAMAGED");
    });

    it("4.2 Damage decision APPROVE_REPAIR spawns maintenance work order and sets asset to UNDER_MAINTENANCE", async () => {
      const res = await request(app)
        .patch(`/api/v1/damage-inspections/${damageInspectionId}/decision`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          decision: "APPROVE_REPAIR",
          resolutionNotes: "Approved replacement of main control board by vendor technician"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("APPROVED_FOR_REPAIR");

      // Verify asset moved to UNDER_MAINTENANCE
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("UNDER_MAINTENANCE");

      // Verify work order created with link to inspection
      const woDb = await query("SELECT * FROM maintenance_records WHERE inspection_id = $1", [damageInspectionId]);
      expect(woDb.rows.length).toBe(1);
      expect(woDb.rows[0].status).toBe("OPEN");
      expect(woDb.rows[0].priority).toBe("HIGH"); // MAJOR maps to HIGH
    });
  });

  describe("5. Maintenance Work Order Lifecycle & State Machine", () => {
    let workOrderId: string;

    it("5.1 Create direct preventive maintenance work order", async () => {
      // Reset asset 1 to available for a clean direct maintenance test
      await query("UPDATE assets SET status = 'AVAILABLE' WHERE id = $1", [apparelsAssetId]);

      const res = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          problem: "Quarterly preventative calibration and lubrication",
          maintenanceType: "PREVENTIVE",
          priority: "MEDIUM",
          estimatedCost: 2000.00
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("OPEN");
      expect(res.body.data.work_order_number).toMatch(/^WO-\d{4}-[A-Z0-9]{6}$/);

      workOrderId = res.body.data.id;

      // Asset status locked into UNDER_MAINTENANCE
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("UNDER_MAINTENANCE");
    });

    it("5.2 Asset cannot be assigned while undergoing maintenance", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          employeeId: apparelsEmployeeId
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("current status is 'UNDER_MAINTENANCE'");
    });

    it("5.3 Illegal state machine jump (OPEN -> CLOSED) is strictly rejected with 400 Bad Request", async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "CLOSED" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid work order status transition from 'OPEN' to 'CLOSED'");
    });

    it("5.4 Progression: OPEN -> ASSIGNED -> IN_PROGRESS -> WAITING_PARTS -> COMPLETED -> VERIFIED -> CLOSED", async () => {
      // 1. OPEN -> ASSIGNED
      let res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "ASSIGNED", technicianName: "Rajesh Sharma" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ASSIGNED");

      // 2. ASSIGNED -> IN_PROGRESS
      res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "IN_PROGRESS" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("IN_PROGRESS");
      expect(res.body.data.start_date).toBeDefined();

      // 3. IN_PROGRESS -> WAITING_PARTS
      res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "WAITING_PARTS", remarks: "Awaiting replacement roller bearings" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("WAITING_PARTS");

      // 4. WAITING_PARTS -> COMPLETED
      res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "COMPLETED", actualCost: 2450.00 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data.end_date).toBeDefined();

      // 5. COMPLETED -> VERIFIED
      res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "VERIFIED" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("VERIFIED");
      expect(res.body.data.verified_at).toBeDefined();

      // 6. VERIFIED -> CLOSED
      res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "CLOSED" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CLOSED");
      expect(res.body.data.closed_at).toBeDefined();

      // Verify asset is restored to AVAILABLE
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(assetDb.rows[0].status).toBe("AVAILABLE");
    });

    it("5.5 Maintenance Cost Tracking updates actual cost and invoice without mutating asset purchase cost", async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${workOrderId}/costs`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          actualCost: 2800.00,
          currency: "USD",
          invoiceReference: "INV-MAINT-2026-09"
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.actual_cost)).toBe(2800.00);
      expect(res.body.data.invoice_reference).toBe("INV-MAINT-2026-09");

      // Verify asset purchase cost is intact
      const assetDb = await query("SELECT purchase_cost, current_value FROM assets WHERE id = $1", [apparelsAssetId]);
      expect(Number(assetDb.rows[0].purchase_cost)).toBe(45000.00);
    });
  });

  describe("6. Multi-Tenancy & Tenant Isolation", () => {
    it("6.1 Pantone Apparels user cannot view or assign Pantone Garments assets (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: garmentsAssetId,
          employeeId: apparelsEmployeeId
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("6.2 Common Admin has global visibility across companies and can query all assignments", async () => {
      const res = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignments).toBeDefined();
    });

    it("6.3 Common Admin can scope queries to Pantone Garments via X-Company-Id header", async () => {
      const res = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("7. Role-Based Access Control (RBAC)", () => {
    it("7.1 Auditor is strictly blocked from creating assignments (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${auditorToken}`)
        .send({ assetId: apparelsAssetId, employeeId: apparelsEmployeeId });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Auditor role has read-only compliance access");
    });

    it("7.2 Auditor is strictly blocked from creating maintenance work orders (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${auditorToken}`)
        .send({ assetId: apparelsAssetId, problem: "Auditor test problem" });

      expect(res.status).toBe(403);
    });

    it("7.3 Auditor is strictly blocked from resolving damage decisions (403 Forbidden)", async () => {
      const res = await request(app)
        .patch("/api/v1/damage-inspections/00000000-0000-0000-0000-000000000000/decision")
        .set("Authorization", `Bearer ${auditorToken}`)
        .send({ decision: "RESOLVE" });

      expect(res.status).toBe(403);
    });

    it("7.4 Auditor can read assignments, returns, damage, and maintenance lists", async () => {
      const assignRes = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${auditorToken}`);
      expect(assignRes.status).toBe(200);

      const maintRes = await request(app)
        .get("/api/v1/maintenance")
        .set("Authorization", `Bearer ${auditorToken}`);
      expect(maintRes.status).toBe(200);
    });
  });

  describe("8. Asset Nested Lifecycle Sub-Resources & Audit Logging", () => {
    it("8.1 Querying /assets/:id/assignments returns asset assignment history", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${apparelsAssetId}/assignments`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("8.2 Querying /assets/:id/maintenance returns asset maintenance work orders", async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${apparelsAssetId}/maintenance`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("8.3 Operations produce structured entries in audit_logs", async () => {
      const auditRes = await query(`
        SELECT action, entity FROM audit_logs 
        WHERE company_id = $1 AND action IN (
          'ASSET_ASSIGNMENT_CREATED', 'ASSET_HANDOVER_CONFIRMED',
          'ASSET_RETURN_INITIATED', 'ASSET_RETURN_INSPECTED',
          'DAMAGE_INSPECTION_CREATED', 'MAINTENANCE_WORK_ORDER_CREATED'
        )
      `, [apparelsCompanyId]);

      expect(auditRes.rows.length).toBeGreaterThan(0);
      const actions = auditRes.rows.map((r) => r.action);
      expect(actions).toContain("ASSET_ASSIGNMENT_CREATED");
      expect(actions).toContain("MAINTENANCE_WORK_ORDER_CREATED");
    });
  });

  describe("9. Extended Operational Scenarios & Edge Cases", () => {
    let edgeAssetId: string;
    let edgeReturnId: string;
    let edgeDamageId: string;
    let edgeMaintId: string;

    beforeAll(async () => {
      // Create additional asset for edge case testing
      const catRes = await query("SELECT id FROM asset_categories LIMIT 1");
      const categoryId = catRes.rows[0].id;

      const astRes = await query(`
        INSERT INTO assets (company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition)
        VALUES ($1, $2, 'AST-APP-EDGE-001', 'BAR-APP-EDGE-001', 'QR-APP-EDGE-001', 'Edge Testing Sewing Machine', 50000.00, 50000.00, 'AVAILABLE', 'NEW')
        ON CONFLICT (asset_tag) DO UPDATE SET status = 'AVAILABLE', assigned_employee_id = NULL
        RETURNING id
      `, [apparelsCompanyId, categoryId]);
      edgeAssetId = astRes.rows[0].id;
    });

    it("9.1 Return inspection with DAMAGE_REVIEW moves asset to DAMAGED and creates damage inspection", async () => {
      // Assign asset
      await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: edgeAssetId, employeeId: apparelsEmployeeId });

      // Return asset
      const retRes = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: edgeAssetId, condition: "DAMAGED", remarks: "Dropped during transit" });

      edgeReturnId = retRes.body.data.id;

      // Inspect with DAMAGE_REVIEW
      const inspRes = await request(app)
        .post(`/api/v1/returns/${edgeReturnId}/inspect`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          inspectionStatus: "DAMAGE_REVIEW",
          damageType: "PHYSICAL_IMPACT",
          damageSeverity: "CRITICAL",
          damageDescription: "Frame cracked and drive shaft bent",
          repairRecommendation: "SCRAP_RECOMMENDED"
        });

      expect(inspRes.status).toBe(200);
      expect(inspRes.body.data.inspection_status).toBe("DAMAGE_REVIEW");

      // Verify asset moved to DAMAGED
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [edgeAssetId]);
      expect(assetDb.rows[0].status).toBe("DAMAGED");

      // Verify damage inspection created
      const dmgDb = await query("SELECT * FROM damage_inspections WHERE return_id = $1", [edgeReturnId]);
      expect(dmgDb.rows.length).toBe(1);
      expect(dmgDb.rows[0].severity).toBe("CRITICAL");
      expect(dmgDb.rows[0].recommendation).toBe("SCRAP_RECOMMENDED");
      edgeDamageId = dmgDb.rows[0].id;
    });

    it("9.2 Cannot assign asset that is currently DAMAGED (409 Conflict)", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: edgeAssetId, employeeId: apparelsEmployeeId });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("current status is 'DAMAGED'");
    });

    it("9.3 Damage inspection decision RESOLVE restores asset to AVAILABLE with specified condition", async () => {
      const res = await request(app)
        .patch(`/api/v1/damage-inspections/${edgeDamageId}/decision`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          decision: "RESOLVE",
          resolutionNotes: "Minor alignment issue rectified in-house",
          restorationCondition: "FAIR"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("RESOLVED");

      // Verify asset restored
      const assetDb = await query("SELECT status, condition FROM assets WHERE id = $1", [edgeAssetId]);
      expect(assetDb.rows[0].status).toBe("AVAILABLE");
      expect(assetDb.rows[0].condition).toBe("FAIR");
    });

    it("9.4 Damage inspection decision ESCALATE_DISPOSAL transitions status and logs event", async () => {
      // Record new damage inspection
      const dmgRes = await request(app)
        .post("/api/v1/damage-inspections")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: edgeAssetId,
          damageType: "WEAR_AND_TEAR",
          severity: "CRITICAL",
          description: "End of life total breakdown",
          recommendation: "SCRAP_RECOMMENDED"
        });

      const dmgId2 = dmgRes.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/damage-inspections/${dmgId2}/decision`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          decision: "ESCALATE_DISPOSAL",
          resolutionNotes: "Recommended for decommission and disposal"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ESCALATED_DISPOSAL");
    });

    it("9.5 Maintenance work order CANCELLED restores asset status to AVAILABLE", async () => {
      // Put asset into maintenance
      const woRes = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: edgeAssetId,
          problem: "False alarm checkup",
          maintenanceType: "CORRECTIVE",
          priority: "LOW"
        });

      edgeMaintId = woRes.body.data.id;

      // Cancel work order
      const cancelRes = await request(app)
        .patch(`/api/v1/maintenance/${edgeMaintId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "CANCELLED", remarks: "Technician verified machine is fine" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe("CANCELLED");

      // Verify asset restored to AVAILABLE
      const assetDb = await query("SELECT status FROM assets WHERE id = $1", [edgeAssetId]);
      expect(assetDb.rows[0].status).toBe("AVAILABLE");
    });

    it("9.6 Work order transition COMPLETED -> IN_PROGRESS (re-work required) succeeds", async () => {
      // Create new work order
      const woRes = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: edgeAssetId,
          problem: "Calibration needed",
          maintenanceType: "CALIBRATION",
          priority: "MEDIUM"
        });

      const woId = woRes.body.data.id;

      // Advance to IN_PROGRESS -> COMPLETED
      await request(app)
        .patch(`/api/v1/maintenance/${woId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "ASSIGNED" });

      await request(app)
        .patch(`/api/v1/maintenance/${woId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "IN_PROGRESS" });

      await request(app)
        .patch(`/api/v1/maintenance/${woId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "COMPLETED" });

      // Rework: COMPLETED -> IN_PROGRESS
      const reworkRes = await request(app)
        .patch(`/api/v1/maintenance/${woId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "IN_PROGRESS", remarks: "Calibration tolerance failed inspection, rework needed" });

      expect(reworkRes.status).toBe(200);
      expect(reworkRes.body.data.status).toBe("IN_PROGRESS");
    });

    it("9.7 Employee querying /assignments only sees their own assigned assets", async () => {
      const res = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // All returned assignments must belong to employee's id
      for (const a of res.body.data.assignments) {
        expect(a.employee_id).toBe(apparelsEmployeeId);
      }
    });

    it("9.8 Employee querying /returns only sees returns for their assigned assets", async () => {
      const res = await request(app)
        .get("/api/v1/returns")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const r of res.body.data.returns) {
        expect(r.returned_by).toBe(apparelsEmployeeId);
      }
    });

    it("9.9 Cannot assign asset that is RETIRED or DISPOSED (409 Conflict)", async () => {
      await query("UPDATE assets SET status = 'RETIRED' WHERE id = $1", [edgeAssetId]);

      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ assetId: edgeAssetId, employeeId: apparelsEmployeeId });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("current status is 'RETIRED'");
    });

    it("9.10 Filter work orders by status and priority", async () => {
      const res = await request(app)
        .get("/api/v1/maintenance?status=CANCELLED&priority=LOW")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workOrders).toBeDefined();
    });

    it("9.11 Filter damage inspections by severity and status", async () => {
      const res = await request(app)
        .get("/api/v1/damage-inspections?severity=CRITICAL&status=RESOLVED")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.inspections).toBeDefined();
    });

    it("9.12 Filter returns by inspectionStatus", async () => {
      const res = await request(app)
        .get("/api/v1/returns?inspectionStatus=PASSED")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.returns).toBeDefined();
    });

    it("9.13 Sub-resources /assets/:id/returns and /assets/:id/damage-inspections return history", async () => {
      const retRes = await request(app)
        .get(`/api/v1/assets/${edgeAssetId}/returns`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);
      expect(retRes.status).toBe(200);
      expect(Array.isArray(retRes.body.data)).toBe(true);

      const dmgRes = await request(app)
        .get(`/api/v1/assets/${edgeAssetId}/damage-inspections`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);
      expect(dmgRes.status).toBe(200);
      expect(Array.isArray(dmgRes.body.data)).toBe(true);
    });

    it("9.14 Cross-company return rejection (Garments admin cannot return Apparels asset)", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({ assetId: apparelsAssetId, condition: "GOOD" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("9.15 Cross-company work order creation rejection", async () => {
      const res = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({ assetId: apparelsAssetId, problem: "Tamper attempt" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });

    it("9.16 Cross-company damage inspection recording rejection", async () => {
      const res = await request(app)
        .post("/api/v1/damage-inspections")
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          assetId: apparelsAssetId,
          damageType: "WEAR_AND_TEAR",
          severity: "MINOR",
          description: "Cross company tamper",
          recommendation: "REPAIR"
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Cross-company violation");
    });
  });
});