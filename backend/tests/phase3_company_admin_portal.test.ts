import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 3: Common Admin Portal, Company Management, User Registry & Audit Ledger", () => {
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;
  let testCompanyId: string;
  const testCompanyCode = `PANTONE-TEST-${Date.now().toString().slice(-6)}`;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let employeeToken: string;
  let auditorToken: string;

  // IDs
  let employeeUserId: string;
  let testCreatedUserId: string;

  beforeAll(async () => {
    // 1. Get companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Login Common Admin
    const caLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });
    commonAdminToken = caLogin.body.data.accessToken;

    // 3. Login Apparels Admin
    const aaLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });
    apparelsAdminToken = aaLogin.body.data.accessToken;

    // 4. Login Garments Admin
    const gaLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "garments_admin", password: env.SEED_GARMENTS_ADMIN_PASSWORD });
    garmentsAdminToken = gaLogin.body.data.accessToken;

    // 5. Ensure roles & test users for Employee & Auditor
    const empRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId]);
    const audRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId]);

    const pwHash = await hashPassword("TestUser#2026!");

    // Employee
    const empUserRes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_p3_emp', 'test_p3_emp@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id
    `, [apparelsCompanyId, pwHash, empRole.rows[0].id]);
    employeeUserId = empUserRes.rows[0].id;

    // Auditor
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_p3_aud', 'test_p3_aud@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id
    `, [apparelsCompanyId, pwHash, audRole.rows[0].id]);

    // Login Employee & Auditor
    const empLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_p3_emp", password: "TestUser#2026!" });
    employeeToken = empLogin.body.data.accessToken;

    const audLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_p3_aud", password: "TestUser#2026!" });
    auditorToken = audLogin.body.data.accessToken;
  }, 30000);

  afterAll(async () => {
    // Cleanup created test records
    if (testCompanyId) {
      await query("DELETE FROM audit_logs WHERE company_id = $1", [testCompanyId]);
      await query("DELETE FROM users WHERE company_id = $1", [testCompanyId]);
      await query("DELETE FROM companies WHERE id = $1", [testCompanyId]);
    }
    await query("DELETE FROM users WHERE username IN ('test_p3_emp', 'test_p3_aud', 'test_p3_co_admin')");
  });

  // ====================================================================
  // GROUP 1: COMPANY MANAGEMENT
  // ====================================================================

  test("1. Common Admin can list companies with pagination and filters", async () => {
    const res = await request(app)
      .get("/api/v1/companies?page=1&limit=5&status=active")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("companies");
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("page", 1);
    expect(res.body.data).toHaveProperty("limit", 5);
    expect(Array.isArray(res.body.data.companies)).toBe(true);
    expect(res.body.data.companies.length).toBeGreaterThanOrEqual(2);
  });

  test("2. Common Admin can create a new company with valid data", async () => {
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: testCompanyCode,
        name: "Pantone Test Textiles Ltd",
        taxId: "TAX-TST-1100",
        address: "Industrial Complex 9, Delhi NCR",
        phone: "+91-11-99887766",
        email: "contact@pantone-test.com"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(testCompanyCode);
    expect(res.body.data.is_active).toBe(true);
    testCompanyId = res.body.data.id;

    // Verify audit log
    const auditRes = await query(
      "SELECT * FROM audit_logs WHERE company_id = $1 AND action = 'COMPANY_CREATE'",
      [testCompanyId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].entity).toBe("companies");
  });

  test("3. Duplicate company code is rejected with 409 Conflict", async () => {
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: testCompanyCode,
        name: "Duplicate Company Code",
        email: "dup@pantone.com"
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("already registered");
  });

  test("4. Invalid company input data is rejected with 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: "X", // too short (min 2)
        name: "",  // too short (min 2)
        email: "not-an-email"
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test("5. Common Admin can view company details and aggregated stats", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(apparelsCompanyId);
    expect(res.body.data.code).toBe("PANTONE-APP");
    expect(res.body.data).toHaveProperty("branch_count");
    expect(res.body.data).toHaveProperty("department_count");
    expect(res.body.data).toHaveProperty("user_count");
    expect(res.body.data).toHaveProperty("asset_count");
  });

  test("6. Common Admin can update company details (audited)", async () => {
    const res = await request(app)
      .put(`/api/v1/companies/${testCompanyId}`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        name: "Pantone Test Textiles Updated Ltd",
        phone: "+91-11-99887700"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Pantone Test Textiles Updated Ltd");
    expect(res.body.data.phone).toBe("+91-11-99887700");

    // Verify audit log has diff
    const auditRes = await query(`
      SELECT * FROM audit_logs 
      WHERE company_id = $1 AND action = 'COMPANY_UPDATE'
      ORDER BY timestamp DESC LIMIT 1
    `, [testCompanyId]);
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].old_values_json).toBeDefined();
    expect(auditRes.rows[0].new_values_json).toBeDefined();
  });

  test("7. Common Admin can deactivate company (soft update, audited)", async () => {
    const res = await request(app)
      .patch(`/api/v1/companies/${testCompanyId}/status`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);

    // Verify company is still in DB (never physically deleted)
    const checkDb = await query("SELECT is_active FROM companies WHERE id = $1", [testCompanyId]);
    expect(checkDb.rows[0].is_active).toBe(false);

    // Verify audit log
    const auditRes = await query(`
      SELECT * FROM audit_logs 
      WHERE company_id = $1 AND action = 'COMPANY_STATUS_UPDATE'
      ORDER BY timestamp DESC LIMIT 1
    `, [testCompanyId]);
    expect(auditRes.rows.length).toBe(1);
  });

  test("8. Common Admin can reactivate company", async () => {
    const res = await request(app)
      .patch(`/api/v1/companies/${testCompanyId}/status`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });

  test("9. Common Admin can query company-specific activity trail", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${testCompanyId}/activity`)
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // CREATE, UPDATE, STATUS_UPDATE
  });

  // ====================================================================
  // GROUP 2: TENANCY & ISOLATION
  // ====================================================================

  test("10. Company Admin can view their own company details", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(apparelsCompanyId);
  });

  test("11. Company Admin cannot access another company details (403 Forbidden)", async () => {
    // Apparels Admin attempting to access Garments
    const res = await request(app)
      .get(`/api/v1/companies/${garmentsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");

    // Garments Admin attempting to access Apparels
    const garRes = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${garmentsAdminToken}`);

    expect(garRes.status).toBe(403);
    expect(garRes.body.message).toContain("Cross-company violation");
  });

  test("12. Employee cannot access company management APIs (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ code: "HACK", name: "Hack Corp" });

    expect(res.status).toBe(403);
  });

  test("13. Tenant tampering via header X-Company-Id from unauthorized user fails", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .set("X-Company-ID", garmentsCompanyId);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("14. Deactivated company users cannot authenticate and are rejected", async () => {
    // 1. Create a user under testCompany
    const pwHash = await hashPassword("Deactivated#2026!");
    const roleRes = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'COMPANY_ADMIN'", [apparelsCompanyId]);
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_in_deactivated_co', 'deact@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [testCompanyId, pwHash, roleRes.rows[0].id]);

    // 2. Deactivate test company
    await query("UPDATE companies SET is_active = false WHERE id = $1", [testCompanyId]);

    // 3. Attempt login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "user_in_deactivated_co", password: "Deactivated#2026!" });

    // Should be rejected with 403 Forbidden
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message.toLowerCase()).toContain("company account has been deactivated");

    // Restore test company
    await query("UPDATE companies SET is_active = true WHERE id = $1", [testCompanyId]);
  });

  // ====================================================================
  // GROUP 3: RBAC ENFORCEMENT
  // ====================================================================

  test("15. Auditor cannot mutate company or user records (read-only enforcement)", async () => {
    // Attempt company update
    const compRes = await request(app)
      .put(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ name: "Auditor Hacked Name" });

    expect(compRes.status).toBe(403);

    // Attempt user status toggle
    const userRes = await request(app)
      .patch(`/api/v1/users/${employeeUserId}/status`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ isActive: false });

    expect(userRes.status).toBe(403);
  });

  // ====================================================================
  // GROUP 4: USER REGISTRY & ADMINISTRATOR MANAGEMENT
  // ====================================================================

  test("16. Common Admin can list all users across companies", async () => {
    const res = await request(app)
      .get("/api/v1/users?page=1&limit=50")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("users");
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(3);

    // Verify company names are present
    const hasApparels = res.body.data.users.some((u: { company_code: string }) => u.company_code === "PANTONE-APP");
    const hasGarments = res.body.data.users.some((u: { company_code: string }) => u.company_code === "PANTONE-GAR");
    expect(hasApparels).toBe(true);
    expect(hasGarments).toBe(true);
  });

  test("17. Company Admin only sees users belonging to their own company", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    for (const u of res.body.data.users) {
      expect(u.company_id).toBe(apparelsCompanyId);
      expect(u.company_code).toBe("PANTONE-APP");
    }
  });

  test("18. Password hashes and sensitive session secrets are never returned in user listings", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    for (const u of res.body.data.users) {
      expect(u.password_hash).toBeUndefined();
      expect(u.password).toBeUndefined();
      expect(u.refresh_token_hash).toBeUndefined();
    }
  });

  test("19. Common Admin can create a company administrator with role assignment", async () => {
    const roleRes = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'COMPANY_ADMIN'", [testCompanyId]);
    let targetRoleId = roleRes.rows[0]?.id;

    if (!targetRoleId) {
      // Use general company admin role or create one for test company
      const defaultRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'COMPANY_ADMIN'", [apparelsCompanyId]);
      targetRoleId = defaultRole.rows[0].id;
    }

    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        username: "test_p3_co_admin",
        email: "co_admin_p3@pantone.com",
        password: "CompanyAdmin#2026!",
        roleId: targetRoleId,
        companyId: testCompanyId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe("test_p3_co_admin");
    expect(res.body.data.password_hash).toBeUndefined();
    testCreatedUserId = res.body.data.id;

    // Verify audit log
    const auditRes = await query("SELECT * FROM audit_logs WHERE action = 'USER_CREATE' AND entity_id = $1", [testCreatedUserId]);
    expect(auditRes.rows.length).toBe(1);
  });

  test("20. Company Admin cannot create a user with global COMMON_ADMIN role (403 Forbidden)", async () => {
    const caRole = await query("SELECT id FROM roles WHERE code = 'COMMON_ADMIN' AND company_id IS NULL");

    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        username: "illegal_admin",
        email: "illegal@pantone.com",
        password: "IllegalAdmin#2026!",
        roleId: caRole.rows[0].id
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("cannot assign global administrative roles");
  });

  test("21. Common Admin can toggle user active status (audited)", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${testCreatedUserId}/status`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);

    // Verify audit log
    const auditRes = await query("SELECT * FROM audit_logs WHERE action = 'USER_STATUS_UPDATE' AND entity_id = $1", [testCreatedUserId]);
    expect(auditRes.rows.length).toBe(1);
  });

  test("22. Available roles endpoint lists roles respecting company scope", async () => {
    // Common Admin gets all roles
    const caRes = await request(app)
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(caRes.status).toBe(200);
    expect(caRes.body.data.length).toBeGreaterThanOrEqual(6);

    // Company Admin gets only their company roles + global
    const aaRes = await request(app)
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(aaRes.status).toBe(200);
    for (const r of aaRes.body.data) {
      expect(r.company_id === null || r.company_id === apparelsCompanyId).toBe(true);
    }
  });

  // ====================================================================
  // GROUP 5: DASHBOARD STATISTICS & AUDIT LOGS
  // ====================================================================

  test("23. Common Admin gets global system dashboard statistics", async () => {
    const res = await request(app)
      .get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe("GLOBAL");
    expect(res.body.data.companies.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.assets).toHaveProperty("total");
    expect(res.body.data.assets).toHaveProperty("by_status");
    expect(res.body.data.operations).toHaveProperty("pending_approvals");
    expect(res.body.data.operations).toHaveProperty("active_transfers");
    expect(res.body.data.operations).toHaveProperty("active_maintenance");
    expect(Array.isArray(res.body.data.company_summaries)).toBe(true);
    expect(Array.isArray(res.body.data.recent_activity)).toBe(true);
  });

  test("24. Common Admin context switcher (via X-Company-Id) returns company-scoped stats", async () => {
    const res = await request(app)
      .get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .set("X-Company-ID", apparelsCompanyId);

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("COMPANY");
    expect(res.body.data.company_id).toBe(apparelsCompanyId);
  });

  test("25. Company Admin automatically receives company-scoped dashboard stats", async () => {
    const res = await request(app)
      .get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("COMPANY");
    expect(res.body.data.company_id).toBe(apparelsCompanyId);
  });

  test("26. Common Admin can query system audit logs with filters and pagination", async () => {
    const res = await request(app)
      .get("/api/v1/audit?page=1&limit=10")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("logs");
    expect(res.body.data).toHaveProperty("total");
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.data.logs.length).toBeGreaterThan(0);
  });

  test("27. Company Admin can only query audit logs belonging to their company", async () => {
    const res = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    for (const log of res.body.data.logs) {
      expect(log.company_id).toBe(apparelsCompanyId);
    }
  });
});
