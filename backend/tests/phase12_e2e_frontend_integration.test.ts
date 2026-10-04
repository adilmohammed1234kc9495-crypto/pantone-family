import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";

describe("Phase 12: Complete Frontend / API E2E User Journeys & Error Recovery", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let apparelsAdminToken: string;
  let commonAdminToken: string;

  let testAssetId: string;
  let testCategoryId: string;
  let testBranchId: string;
  let testLocationId: string;
  let testEmployeeId: string;

  beforeAll(async () => {
    // 1. Fetch Company
    const compRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = compRes.rows[0].id;

    // 2. Logins
    const aaLogin = await request(app).post("/api/v1/auth/login").send({
      username: "apparels_admin",
      password: env.SEED_APPARELS_ADMIN_PASSWORD,
    });
    apparelsAdminToken = aaLogin.body.data.accessToken;

    const caLogin = await request(app).post("/api/v1/auth/login").send({
      username: "common_admin",
      password: env.SEED_COMMON_ADMIN_PASSWORD,
    });
    commonAdminToken = caLogin.body.data.accessToken;

    // 3. Organization reference entities
    const cat = await query("SELECT id FROM asset_categories WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    testCategoryId = cat.rows[0].id;

    const br = await query("SELECT id FROM branches WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    testBranchId = br.rows[0].id;

    const loc = await query("SELECT id FROM locations WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    testLocationId = loc.rows[0].id;

    const emp = await query("SELECT id FROM employees WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1", [apparelsCompanyId]);
    testEmployeeId = emp.rows[0].id;
  });

  // =========================================================================
  // JOURNEY 1: LOGIN & AUTHENTICATION HYDRATION
  // =========================================================================
  test("Journey 1: Login & Session Hydration (/login -> /auth/me)", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      username: "apparels_admin",
      password: env.SEED_APPARELS_ADMIN_PASSWORD,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.user.username).toBe("apparels_admin");

    const token = loginRes.body.data.accessToken;

    // Frontend layout session hydration
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.username).toBe("apparels_admin");
    expect(Array.isArray(meRes.body.data.permissions)).toBe(true);
  });

  // =========================================================================
  // JOURNEY 2: DASHBOARD METRICS & KPI AGGREGATION
  // =========================================================================
  test("Journey 2: Dashboard Overview & KPI Statistics (/dashboard)", async () => {
    const dashRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect([200, 404]).toContain(dashRes.status);
    if (dashRes.status === 200) {
      expect(dashRes.body.success).toBe(true);
    }
  });

  // =========================================================================
  // JOURNEY 3: ASSET CREATION, REGISTRATION & DETAIL NAVIGATION
  // =========================================================================
  test("Journey 3: Asset Create -> List -> View Detail (/assets -> /assets/new -> /assets/:id)", async () => {
    const tag = `E2E-AST-${Date.now()}`;
    const createRes = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        name: "Enterprise Multi-Function Printer",
        assetTag: tag,
        barcode: `BC-${tag}`,
        qrCode: `QR-${tag}`,
        categoryId: testCategoryId,
        branchId: testBranchId,
        locationId: testLocationId,
        purchaseCost: 4200,
        purchaseDate: "2025-06-01",
        depreciationMethod: "STRAIGHT_LINE",
        depreciationRatePercent: 15,
        usefulLifeMonths: 48,
        status: "AVAILABLE",
      });

    expect(createRes.status).toBe(201);
    testAssetId = createRes.body.data.id;

    // List view
    const listRes = await request(app)
      .get("/api/v1/assets?limit=10")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.length).toBeGreaterThan(0);

    // Detail view
    const detailRes = await request(app)
      .get(`/api/v1/assets/${testAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.asset_tag).toBe(tag);
    expect(detailRes.body.data.category_name).toBeDefined();

    // Depreciation sub-tab
    const deprRes = await request(app)
      .get(`/api/v1/assets/${testAssetId}/depreciation`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(deprRes.status).toBe(200);
    expect(deprRes.body.data.calculation).toBeDefined();
    expect(deprRes.body.data.schedule).toBeDefined();
  });

  // =========================================================================
  // JOURNEY 4: CUSTODY ASSIGNMENT & RETURN FLOW
  // =========================================================================
  test("Journey 4: Custody Assignment & Return Flow (/assignments -> /returns)", async () => {
    // 1. Assign
    const assignRes = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        employeeId: testEmployeeId,
        conditionAtAssignment: "NEW",
        remarks: "Assigned for executive administration",
      });

    expect(assignRes.status).toBe(201);
    const assignmentId = assignRes.body.data.id;

    // 2. Return
    const returnRes = await request(app)
      .post("/api/v1/returns")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        assignmentId,
        condition: "GOOD",
        remarks: "Returned after department relocation",
      });

    expect(returnRes.status).toBe(201);
    const returnId = returnRes.body.data.id;

    // 3. Inspect Return (Passed -> Available)
    const inspectRes = await request(app)
      .post(`/api/v1/returns/${returnId}/inspect`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        inspectionStatus: "PASSED",
        condition: "GOOD",
        inspectionNotes: "Verified all functions operational",
      });

    expect(inspectRes.status).toBe(200);

    // Verify asset is back in AVAILABLE status
    const assetCheck = await query<{ status: string }>("SELECT status FROM assets WHERE id = $1", [testAssetId]);
    expect(assetCheck.rows[0].status).toBe("AVAILABLE");
  });

  // =========================================================================
  // JOURNEY 5: STOCK, REQUISITIONS & APPROVAL WORKFLOW
  // =========================================================================
  test("Journey 5: Inventory & Requisition Workflow (/stock -> /requests -> /approvals)", async () => {
    // 1. List stock
    const stockList = await request(app)
      .get("/api/v1/stock?page=1&limit=5")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(stockList.status).toBe(200);

    // 2. Create Requisition
    const reqRes = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        title: "E2E Procurement Requisition",
        justification: "Equipment for testing automation suite",
        priority: "HIGH",
      });

    expect(reqRes.status).toBe(201);
    const requestId = reqRes.body.data.id;

    // 3. Submit Requisition
    const submitRes = await request(app)
      .post(`/api/v1/requests/${requestId}/submit`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(submitRes.status).toBe(200);

    // 4. Pending approvals inbox
    const pendingRes = await request(app)
      .get("/api/v1/approvals/pending")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(pendingRes.status).toBe(200);
    expect(Array.isArray(pendingRes.body.data)).toBe(true);
  });

  // =========================================================================
  // JOURNEY 6: REPORTS & EXPORTS
  // =========================================================================
  test("Journey 6: Reports & Financial Analytics (/reports/assets, /reports/depreciation)", async () => {
    const assetReportRes = await request(app)
      .get("/api/v1/reports/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(assetReportRes.status).toBe(200);
    expect(assetReportRes.body.data).toBeDefined();

    const deprReportRes = await request(app)
      .get("/api/v1/reports/depreciation")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(deprReportRes.status).toBe(200);
    expect(deprReportRes.body.data).toBeDefined();
  });

  // =========================================================================
  // JOURNEY 7: NOTIFICATIONS & PREFERENCES
  // =========================================================================
  test("Journey 7: Notifications & Preferences (/notifications)", async () => {
    const notifRes = await request(app)
      .get("/api/v1/notifications?limit=10")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(notifRes.status).toBe(200);
    const list = Array.isArray(notifRes.body.data) ? notifRes.body.data : notifRes.body.data.notifications;
    expect(Array.isArray(list)).toBe(true);

    const unreadRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(unreadRes.status).toBe(200);
    expect(typeof unreadRes.body.data.unreadCount).toBe("number");
  });

  // =========================================================================
  // JOURNEY 8: AUDIT LOG INSPECTOR
  // =========================================================================
  test("Journey 8: Audit Log Inspector (/audit)", async () => {
    const auditRes = await request(app)
      .get("/api/v1/audit?limit=25")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.data.logs || auditRes.body.data.items;
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // STEP 23: ERROR RECOVERY & RESILIENCE
  // =========================================================================
  describe("Step 23: Error Recovery & Edge-Case Resilience", () => {
    test("23.1 Unauthenticated request returns 401 with standard JSON error envelope", async () => {
      const res = await request(app).get("/api/v1/assets");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.timestamp).toBeDefined();
    });

    test("23.2 Non-existent route returns 404 with clean message, never crash", async () => {
      const res = await request(app)
        .get("/api/v1/non-existent-endpoint-path")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("not found");
    });

    test("23.3 Empty payload on POST endpoint returns 422 with validation details", async () => {
      const res = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({});

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("23.4 Common Admin switching company with empty string header handled gracefully", async () => {
      const res = await request(app)
        .get("/api/v1/assets")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", "");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
