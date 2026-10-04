import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { notificationService } from "../src/modules/notifications/notification.service";

describe("Phase 12: Concurrency, State Machine, Financials, Transfers & API Robustness", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  let apparelsAdminToken: string;
  let garmentsAdminToken: string;

  let apparelsAdminUserId: string;
  let apparelsBranchId: string;
  let apparelsLocationId: string;
  let apparelsCategoryId: string;
  let apparelsEmployeeId1: string;
  let apparelsEmployeeId2: string;
  let garmentsEmployeeId: string;

  beforeAll(async () => {
    // 1. Get companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;
    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Logins
    await request(app).post("/api/v1/auth/login").send({
      username: "common_admin",
      password: env.SEED_COMMON_ADMIN_PASSWORD,
    });

    const aaLogin = await request(app).post("/api/v1/auth/login").send({
      username: "apparels_admin",
      password: env.SEED_APPARELS_ADMIN_PASSWORD,
    });
    apparelsAdminToken = aaLogin.body.data.accessToken;
    apparelsAdminUserId = aaLogin.body.data.user.id;

    const gaLogin = await request(app).post("/api/v1/auth/login").send({
      username: "garments_admin",
      password: env.SEED_GARMENTS_ADMIN_PASSWORD,
    });
    garmentsAdminToken = gaLogin.body.data.accessToken;

    // 3. Organization reference entities
    const bRes = await query("SELECT id FROM branches WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    apparelsBranchId = bRes.rows[0].id;

    const lRes = await query("SELECT id FROM locations WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    apparelsLocationId = lRes.rows[0].id;

    const catRes = await query("SELECT id FROM asset_categories WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    apparelsCategoryId = catRes.rows[0].id;

    const empRes = await query("SELECT id FROM employees WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 2", [apparelsCompanyId]);
    apparelsEmployeeId1 = empRes.rows[0].id;
    apparelsEmployeeId2 = empRes.rows[1]?.id || empRes.rows[0].id;

    const gEmpRes = await query("SELECT id FROM employees WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1", [garmentsCompanyId]);
    garmentsEmployeeId = gEmpRes.rows[0].id;
  });

  // =========================================================================
  // STEP 18: CONCURRENCY & RACE CONDITION TESTING (MANDATORY)
  // =========================================================================
  describe("Step 18: Concurrency & Row Locking Integrity", () => {
    test("18.1 Concurrent Stock Issues: Row locking prevents over-allocation & negative stock", async () => {
      // 1. Create a fresh stock item with exactly 5 units on hand
      const itemCode = `RACE-STOCK-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: itemCode,
          itemName: "Race Condition Fabric Test",
          unitOfMeasure: "ROLL",
          quantityOnHand: 5,
          unitCost: 50,
          locationId: apparelsLocationId,
        });

      expect(createRes.status).toBe(201);
      const stockItemId = createRes.body.data.id;

      // 2. Launch 10 simultaneous requests each attempting to issue 1 unit
      const issueRequests = Array.from({ length: 10 }).map(() =>
        request(app)
          .post(`/api/v1/stock/${stockItemId}/movements`)
          .set("Authorization", `Bearer ${apparelsAdminToken}`)
          .send({
            movementType: "ISSUE",
            quantity: 1,
            notes: "Concurrent issue attempt",
          })
      );

      const results = await Promise.all(issueRequests);

      // Count successes (200/201) vs failures (400 insufficient stock)
      const successCount = results.filter((r) => r.status === 200 || r.status === 201).length;
      const failureCount = results.filter((r) => r.status === 400).length;

      expect(successCount).toBe(5);
      expect(failureCount).toBe(5);

      // Verify that final quantity in DB is strictly 0 and never negative
      const verifyRes = await query<{ quantity_on_hand: number }>(
        "SELECT quantity_on_hand FROM stock_items WHERE id = $1",
        [stockItemId]
      );
      expect(Number(verifyRes.rows[0].quantity_on_hand)).toBe(0);
    });

    test("18.2 Concurrent Asset Assignment: Only one assignment succeeds, second gets 409 Conflict", async () => {
      // 1. Create an available asset
      const assetTag = `RACE-AST-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "Race Condition MacBook",
          assetTag,
          barcode: `BC-${assetTag}`,
          qrCode: `QR-${assetTag}`,
          categoryId: apparelsCategoryId,
          branchId: apparelsBranchId,
          locationId: apparelsLocationId,
          purchaseCost: 2000,
          status: "AVAILABLE",
        });

      expect(createRes.status).toBe(201);
      const assetId = createRes.body.data.id;

      // 2. Simultaneously fire two assignment requests for different employees
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/v1/assignments")
          .set("Authorization", `Bearer ${apparelsAdminToken}`)
          .send({
            assetId,
            employeeId: apparelsEmployeeId1,
            conditionAtAssignment: "NEW",
          }),
        request(app)
          .post("/api/v1/assignments")
          .set("Authorization", `Bearer ${apparelsAdminToken}`)
          .send({
            assetId,
            employeeId: apparelsEmployeeId2,
            conditionAtAssignment: "NEW",
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Exactly one active assignment in DB
      const activeAssignments = await query(
        "SELECT id FROM asset_assignments WHERE asset_id = $1 AND status = 'ACTIVE'",
        [assetId]
      );
      expect(activeAssignments.rows.length).toBe(1);

      // Asset status is ASSIGNED
      const assetCheck = await query<{ status: string }>("SELECT status FROM assets WHERE id = $1", [assetId]);
      expect(assetCheck.rows[0].status).toBe("ASSIGNED");
    });
  });

  // =========================================================================
  // STEP 6, 8, 9: ASSET LIFECYCLE & STATE MACHINE INTEGRITY
  // =========================================================================
  describe("Steps 6, 8, 9: Complete Lifecycle & State Machine Enforcement", () => {
    let lifecycleAssetId: string;
    let returnId: string;

    test("6.1 Register and capitalize asset", async () => {
      const tag = `LC-AST-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "Dell Precision Workstation",
          assetTag: tag,
          barcode: `BC-${tag}`,
          qrCode: `QR-${tag}`,
          categoryId: apparelsCategoryId,
          branchId: apparelsBranchId,
          locationId: apparelsLocationId,
          purchaseCost: 3500,
          depreciationMethod: "STRAIGHT_LINE",
          depreciationRatePercent: 20,
          usefulLifeMonths: 60,
          status: "AVAILABLE",
        });

      expect(res.status).toBe(201);
      lifecycleAssetId = res.body.data.id;
    });

    test("6.2 Assign custody to employee (AVAILABLE -> ASSIGNED)", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          employeeId: apparelsEmployeeId1,
          conditionAtAssignment: "EXCELLENT",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();

      const assetRes = await query<{ status: string }>("SELECT status FROM assets WHERE id = $1", [lifecycleAssetId]);
      expect(assetRes.rows[0].status).toBe("ASSIGNED");
    });

    test("6.3 State Machine Protection: Cannot reassign already ASSIGNED asset", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          employeeId: apparelsEmployeeId2,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("cannot be assigned because its current status is 'ASSIGNED'");
    });

    test("6.4 Return asset (ASSIGNED -> RETURNED)", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          condition: "DAMAGED",
          remarks: "Returned with chassis crack",
        });

      expect(res.status).toBe(201);
      returnId = res.body.data.id;

      const assetRes = await query<{ status: string }>(
        "SELECT status FROM assets WHERE id = $1",
        [lifecycleAssetId]
      );
      expect(assetRes.rows[0].status).toBe("RETURNED");
    });

    test("6.5 Return Inspection with DAMAGE_REVIEW (RETURNED -> DAMAGED)", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/${returnId}/inspect`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          inspectionStatus: "DAMAGE_REVIEW",
          condition: "DAMAGED",
          damageType: "CRACKED_HOUSING",
          damageSeverity: "MAJOR",
          damageDescription: "Severe cracked chassis",
          repairRecommendation: "REPAIR",
        });

      expect(res.status).toBe(200);

      const assetRes = await query<{ status: string; condition: string }>(
        "SELECT status, condition FROM assets WHERE id = $1",
        [lifecycleAssetId]
      );
      expect(assetRes.rows[0].status).toBe("DAMAGED");
      expect(assetRes.rows[0].condition).toBe("DAMAGED");
    });

    test("6.6 State Machine Protection: Cannot transfer DAMAGED asset", async () => {
      const res = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          transferType: "LOCATION_TO_LOCATION",
          toLocationId: apparelsLocationId,
          reason: "Relocating damaged unit",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("cannot be transferred because its current status is 'DAMAGED'");
    });

    test("6.7 Initiate maintenance work order (DAMAGED -> UNDER_MAINTENANCE)", async () => {
      const res = await request(app)
        .post("/api/v1/maintenance")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          problem: "Repair chassis and replace housing",
          estimatedCost: 250,
        });

      expect(res.status).toBe(201);

      const assetRes = await query<{ status: string }>("SELECT status FROM assets WHERE id = $1", [lifecycleAssetId]);
      expect(assetRes.rows[0].status).toBe("UNDER_MAINTENANCE");
    });

    test("6.8 State Machine Protection: Cannot assign asset UNDER_MAINTENANCE", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: lifecycleAssetId,
          employeeId: apparelsEmployeeId1,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("UNDER_MAINTENANCE");
    });

    test("6.9 Complete maintenance and restore asset to service (UNDER_MAINTENANCE -> AVAILABLE)", async () => {
      const mRes = await query<{ id: string }>(
        "SELECT id FROM maintenance_records WHERE asset_id = $1 AND status != 'CLOSED' LIMIT 1",
        [lifecycleAssetId]
      );
      const maintId = mRes.rows[0].id;

      // Transition: OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> VERIFIED -> CLOSED
      await request(app).patch(`/api/v1/maintenance/${maintId}/status`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({ status: "ASSIGNED" });
      await request(app).patch(`/api/v1/maintenance/${maintId}/status`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({ status: "IN_PROGRESS" });
      await request(app).patch(`/api/v1/maintenance/${maintId}/status`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({ status: "COMPLETED", actualCost: 240 });
      await request(app).patch(`/api/v1/maintenance/${maintId}/status`).set("Authorization", `Bearer ${apparelsAdminToken}`).send({ status: "VERIFIED" });
      
      const closeRes = await request(app)
        .patch(`/api/v1/maintenance/${maintId}/status`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ status: "CLOSED" });

      expect(closeRes.status).toBe(200);

      const assetRes = await query<{ status: string; condition: string }>(
        "SELECT status, condition FROM assets WHERE id = $1",
        [lifecycleAssetId]
      );
      expect(assetRes.rows[0].status).toBe("AVAILABLE");
      expect(assetRes.rows[0].condition).toBe("GOOD");
    });
  });

  // =========================================================================
  // STEP 7: FINANCIAL & DEPRECIATION MATHEMATICS
  // =========================================================================
  describe("Step 7: Financial & Depreciation Accuracy", () => {
    test("7.1 Reject negative purchase cost", async () => {
      const res = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "Invalid Cost Machine",
          categoryId: apparelsCategoryId,
          purchaseCost: -500,
        });

      expect(res.status).toBe(422);
    });

    test("7.2 Straight-line depreciation calculation returns consistent schedule & non-negative book value", async () => {
      const tag = `FIN-AST-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "Industrial Sewing Machine",
          assetTag: tag,
          barcode: `BC-${tag}`,
          qrCode: `QR-${tag}`,
          categoryId: apparelsCategoryId,
          purchaseCost: 6000,
          depreciationMethod: "STRAIGHT_LINE",
          depreciationRatePercent: 20,
          usefulLifeMonths: 60,
          purchaseDate: "2024-01-01",
          depreciationStartDate: "2024-01-01",
          status: "AVAILABLE",
        });

      expect(createRes.status).toBe(201);
      const assetId = createRes.body.data.id;

      // Query depreciation details
      const deprRes = await request(app)
        .get(`/api/v1/assets/${assetId}/depreciation`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(deprRes.status).toBe(200);
      expect(deprRes.body.success).toBe(true);

      const { calculation, schedule } = deprRes.body.data;
      expect(calculation.purchaseCost).toBe(6000);
      expect(calculation.bookValue).toBeLessThanOrEqual(6000);
      expect(calculation.bookValue).toBeGreaterThanOrEqual(0);
      expect(calculation.accumulatedDepreciation).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(schedule)).toBe(true);
      expect(schedule.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // STEP 10: STOCK & INVENTORY OPERATIONS
  // =========================================================================
  describe("Step 10: Stock Operations & Inventory Ledger", () => {
    test("10.1 Stock movement ledger tracks receipts and adjustments accurately", async () => {
      const code = `STK-LEDGER-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: code,
          itemName: "Premium Cotton Thread",
          unitOfMeasure: "SPOOL",
          quantityOnHand: 100,
          unitCost: 15.5,
          locationId: apparelsLocationId,
        });

      expect(createRes.status).toBe(201);
      const itemId = createRes.body.data.id;

      // Record adjustment receipt
      const adjRes = await request(app)
        .post(`/api/v1/stock/${itemId}/movements`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          movementType: "ADJUSTMENT_IN",
          quantity: 25,
          notes: "Audit physical count discrepancy adjustment",
        });

      expect(adjRes.status).toBe(201);

      // Verify on hand is now 125
      const itemRes = await request(app)
        .get(`/api/v1/stock/${itemId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(itemRes.body.data.quantity_on_hand).toBe(125);
    });
  });

  // =========================================================================
  // STEP 11: REQUISITION & APPROVAL WORKFLOW
  // =========================================================================
  describe("Step 11: Requisition & Approval Workflow", () => {
    test("11.1 Requisition creation, submission, and cancellation protection", async () => {
      // Create request
      const createRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          requestType: "ASSET_ALLOCATION",
          priority: "MEDIUM",
          title: "New Employee Workstation Requisition",
          justification: "Onboarding developer workstation setup",
          requiredByDate: "2026-10-31",
        });

      expect(createRes.status).toBe(201);
      const reqId = createRes.body.data.id;

      // Submit request
      const subRes = await request(app)
        .post(`/api/v1/requests/${reqId}/submit`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(subRes.status).toBe(200);

      // Cancel request
      const cancelRes = await request(app)
        .post(`/api/v1/requests/${reqId}/cancel`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ cancellationReason: "Position cancelled" });

      expect(cancelRes.status).toBe(200);

      // Cannot fulfill a cancelled request
      const fulfillRes = await request(app)
        .post(`/api/v1/requests/${reqId}/fulfill`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect([400, 409]).toContain(fulfillRes.status);
    });
  });

  // =========================================================================
  // STEP 13: INTER-COMPANY TRANSFER PROTOCOL (DUAL AUTHORIZATION)
  // =========================================================================
  describe("Step 13: Inter-Company Transfer Protocol", () => {
    let transferAssetId: string;
    let transferId: string;

    test("13.1 Company A initiates inter-company transfer to Company B", async () => {
      // Create transferable asset in Company A
      const tag = `ICT-AST-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "High-Capacity Cutting Plotter",
          assetTag: tag,
          barcode: `BC-${tag}`,
          qrCode: `QR-${tag}`,
          categoryId: apparelsCategoryId,
          branchId: apparelsBranchId,
          locationId: apparelsLocationId,
          purchaseCost: 15000,
          status: "AVAILABLE",
        });

      transferAssetId = createRes.body.data.id;

      // Initiate transfer
      const trfRes = await request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          assetId: transferAssetId,
          transferType: "INTER_COMPANY",
          toCompanyId: garmentsCompanyId,
          reason: "Production load rebalancing to Garments unit",
        });

      expect(trfRes.status).toBe(201);
      transferId = trfRes.body.data.id;
    });

    test("13.2 Approve and dispatch transfer (AVAILABLE -> IN_TRANSIT)", async () => {
      // Approve
      const appRes = await request(app)
        .post(`/api/v1/transfers/${transferId}/approve`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ approvalNotes: "Approved by Apparels Admin" });

      expect(appRes.status).toBe(200);

      // Dispatch
      const dispRes = await request(app)
        .post(`/api/v1/transfers/${transferId}/dispatch`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ dispatchNotes: "Courier pickup verified" });

      expect(dispRes.status).toBe(200);

      // Verify asset status is IN_TRANSIT
      const assetCheck = await query<{ status: string }>("SELECT status FROM assets WHERE id = $1", [transferAssetId]);
      expect(assetCheck.rows[0].status).toBe("IN_TRANSIT");
    });

    test("13.3 Dual Authorization Protocol: Company A cannot confirm receipt of transfer sent to Company B", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${transferId}/receive`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          conditionAfter: "GOOD",
          acknowledgementNotes: "Unauthorized receipt attempt by sender",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Dual authorization violation");
    });

    test("13.4 Company B authorizes receipt -> Atomic Asset Re-Homing to Company B", async () => {
      const res = await request(app)
        .post(`/api/v1/transfers/${transferId}/receive`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          conditionAfter: "GOOD",
          destinationEmployeeId: garmentsEmployeeId,
          acknowledgementNotes: "Received in good order by Garments unit",
        });

      expect(res.status).toBe(200);

      // Check DB: Asset must now belong to Company B!
      const assetCheck = await query<{ company_id: string; status: string; assigned_employee_id: string }>(
        "SELECT company_id, status, assigned_employee_id FROM assets WHERE id = $1",
        [transferAssetId]
      );

      expect(assetCheck.rows[0].company_id).toBe(garmentsCompanyId);
      expect(assetCheck.rows[0].status).toBe("ASSIGNED");
      expect(assetCheck.rows[0].assigned_employee_id).toBe(garmentsEmployeeId);

      // Verify only ONE asset row exists (no duplicate created)
      const countRes = await query<{ count: string }>("SELECT COUNT(*) FROM assets WHERE id = $1", [transferAssetId]);
      expect(Number(countRes.rows[0].count)).toBe(1);
    });
  });

  // =========================================================================
  // STEP 15 & 19: IDEMPOTENCY & DUPLICATE PROTECTION
  // =========================================================================
  describe("Step 19: Idempotency & Notification Deduplication", () => {
    test("19.1 Notification deduplication via idempotencyKey prevents duplicate alerts", async () => {
      const idempotencyKey = `IDEMP_NOTIF_${Date.now()}`;

      // First creation should succeed
      const notif1 = await notificationService.create({
        userId: apparelsAdminUserId,
        companyId: apparelsCompanyId,
        title: "Idempotent Alert",
        message: "Unique critical notice",
        severity: "CRITICAL",
        notificationType: "SECURITY_ALERT",
        idempotencyKey,
      });

      expect(notif1).not.toBeNull();
      expect(notif1?.idempotency_key).toBe(idempotencyKey);

      // Second duplicate creation with same key MUST return null (deduplicated)
      const notif2 = await notificationService.create({
        userId: apparelsAdminUserId,
        companyId: apparelsCompanyId,
        title: "Idempotent Alert",
        message: "Duplicate replay notice",
        severity: "CRITICAL",
        notificationType: "SECURITY_ALERT",
        idempotencyKey,
      });

      expect(notif2).toBeNull();

      // Verify exactly one row in DB
      const countRes = await query<{ count: string }>(
        "SELECT COUNT(*) FROM notifications WHERE idempotency_key = $1",
        [idempotencyKey]
      );
      expect(Number(countRes.rows[0].count)).toBe(1);
    });
  });

  // =========================================================================
  // STEP 17: EXTREME API ROBUSTNESS & FUZZING
  // =========================================================================
  describe("Step 17: API Robustness, Input Validation & Security Payloads", () => {
    test("17.1 SQL Injection string in search parameters is handled as literal text", async () => {
      const sqli = "' OR '1'='1' --";
      const res = await request(app)
        .get(`/api/v1/assets?search=${encodeURIComponent(sqli)}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
    });

    test("17.2 Malformed UUID in route parameter returns 400 Bad Request, never 500", async () => {
      const res = await request(app)
        .get("/api/v1/assets/not-a-valid-uuid-string")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid input syntax");
    });

    test("17.3 Negative stock quantity in movement returns 422 Validation Error", async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "NEG-QTY-TEST",
          itemName: "Negative Quantity Item",
          quantityOnHand: -10,
        });

      expect([400, 422]).toContain(res.status);
    });

    test("17.4 Very long text string in remarks does not crash or leak server stack trace", async () => {
      const hugeString = "A".repeat(8000);
      const res = await request(app)
        .get(`/api/v1/assets?search=${encodeURIComponent(hugeString)}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("stack");
    });
  });

  // =========================================================================
  // STEP 20: DATABASE INTEGRITY & CONSTRAINTS
  // =========================================================================
  describe("Step 20: Database Integrity & Relational Constraints", () => {
    test("20.1 Reject foreign key to non-existent company", async () => {
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      await expect(
        query(`
          INSERT INTO asset_categories (company_id, code, name)
          VALUES ($1, 'FAKE_CODE', 'Fake Category')
        `, [fakeUuid])
      ).rejects.toThrow();
    });

    test("20.2 Unique constraint on company codes prevents duplicates", async () => {
      await expect(
        query(`
          INSERT INTO companies (code, name, country)
          VALUES ('PANTONE-APP', 'Duplicate Company Attempt', 'India')
        `)
      ).rejects.toThrow();
    });
  });
});
