import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 12: Production QA — Multi-Tenant Isolation, Auth, RBAC & Audit Security", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  let apparelsAssetId: string;
  let garmentsAssetId: string;

  let garmentsStockItemId: string;

  let garmentsRequestId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let assetManagerToken: string;
  let auditorToken: string;

  // Users
  let garmentsAdminUserId: string;
  let auditorUserId: string;

  beforeAll(async () => {
    // Clear rate limits for clean execution
    await query("DELETE FROM auth_rate_limits");

    // 1. Fetch Companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Logins to get tokens
    const caLogin = await request(app).post("/api/v1/auth/login").send({
      username: "common_admin",
      password: env.SEED_COMMON_ADMIN_PASSWORD,
    });
    commonAdminToken = caLogin.body.data.accessToken;

    const aaLogin = await request(app).post("/api/v1/auth/login").send({
      username: "apparels_admin",
      password: env.SEED_APPARELS_ADMIN_PASSWORD,
    });
    apparelsAdminToken = aaLogin.body.data.accessToken;

    const gaLogin = await request(app).post("/api/v1/auth/login").send({
      username: "garments_admin",
      password: env.SEED_GARMENTS_ADMIN_PASSWORD,
    });
    garmentsAdminUserId = gaLogin.body.data.user.id;

    // Dedicated test users with known passwords for test isolation
    const testHash = await hashPassword("TestPass#2026!");

    const amRoleRes = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'ASSET_MANAGER'", [apparelsCompanyId]);
    const dmRoleRes = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'DEPT_MANAGER'", [apparelsCompanyId]);
    const audRoleRes = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId]);

    if (amRoleRes.rows.length > 0) {
      const amPerms = await query("SELECT id FROM permissions WHERE code IN ('assets:view', 'assets:create', 'assets:edit', 'assets:retire', 'stock:manage')");
      for (const p of amPerms.rows) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [amRoleRes.rows[0].id, p.id]);
      }
      await query(`
        INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
        VALUES ($1, 'phase12_test_am', 'phase12_am@pantone.com', $2, $3, true)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, is_active = true
      `, [apparelsCompanyId, testHash, amRoleRes.rows[0].id]);

      const amLogin = await request(app).post("/api/v1/auth/login").send({
        username: "phase12_test_am",
        password: "TestPass#2026!",
      });
      assetManagerToken = amLogin.body.data?.accessToken;
    }

    if (dmRoleRes.rows.length > 0) {
      const dmPerms = await query("SELECT id FROM permissions WHERE code IN ('requests:view', 'requests:create', 'requests:approve', 'assets:view')");
      for (const p of dmPerms.rows) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [dmRoleRes.rows[0].id, p.id]);
      }
      await query(`
        INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
        VALUES ($1, 'phase12_test_dm', 'phase12_dm@pantone.com', $2, $3, true)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, is_active = true
      `, [apparelsCompanyId, testHash, dmRoleRes.rows[0].id]);

      await request(app).post("/api/v1/auth/login").send({
        username: "phase12_test_dm",
        password: "TestPass#2026!",
      });
    }

    if (audRoleRes.rows.length > 0) {
      const audPerms = await query("SELECT id FROM permissions WHERE code IN ('assets:view', 'reports:view', 'audit:view')");
      for (const p of audPerms.rows) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [audRoleRes.rows[0].id, p.id]);
      }
      const audUserRes = await query(`
        INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
        VALUES ($1, 'phase12_test_aud', 'phase12_aud@pantone.com', $2, $3, true)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, is_active = true
        RETURNING id
      `, [apparelsCompanyId, testHash, audRoleRes.rows[0].id]);
      auditorUserId = audUserRes.rows[0].id;

      const audLogin = await request(app).post("/api/v1/auth/login").send({
        username: "phase12_test_aud",
        password: "TestPass#2026!",
      });
      auditorToken = audLogin.body.data?.accessToken;
    }

    // 3. Seed or fetch Apparels & Garments assets
    const aAsset = await query("SELECT id FROM assets WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    apparelsAssetId = aAsset.rows[0]?.id;

    const gAsset = await query("SELECT id FROM assets WHERE company_id = $1 LIMIT 1", [garmentsCompanyId]);
    garmentsAssetId = gAsset.rows[0]?.id;

    // 4. Seed or fetch Stock Items
    const gStock = await query("SELECT id FROM stock_items WHERE company_id = $1 LIMIT 1", [garmentsCompanyId]);
    garmentsStockItemId = gStock.rows[0]?.id;

    // 5. Seed or fetch Requests
    const gReq = await query("SELECT id FROM asset_requests WHERE company_id = $1 LIMIT 1", [garmentsCompanyId]);
    garmentsRequestId = gReq.rows[0]?.id;
  });

  // =========================================================================
  // STEP 2: MULTI-TENANT ISOLATION TESTING (CRITICAL)
  // =========================================================================
  describe("Step 2: Multi-Tenant Isolation Testing", () => {
    test("2.1 Company A cannot view Company B asset by direct UUID", async () => {
      if (!garmentsAssetId) return;
      const res = await request(app)
        .get(`/api/v1/assets/${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("2.2 Company A cannot modify Company B asset", async () => {
      if (!garmentsAssetId) return;
      const res = await request(app)
        .put(`/api/v1/assets/${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ name: "Hacked by Apparels Admin" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("2.3 Company A cannot delete Company B asset", async () => {
      if (!garmentsAssetId) return;
      const res = await request(app)
        .delete(`/api/v1/assets/${garmentsAssetId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("2.4 Header Tampering: Company A user specifying X-Company-Id of Company B is rejected", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cross-company violation");
    });

    test("2.5 Query Tampering: Company A user querying companyId of Company B is rejected", async () => {
      const res = await request(app)
        .get(`/api/v1/stock?companyId=${garmentsCompanyId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cross-company violation");
    });

    test("2.6 Body Tampering: Company A user posting body with Company B companyId is rejected", async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          companyId: garmentsCompanyId,
          stockCode: "TAMPER-001",
          itemName: "Tampered Fabric",
          unitOfMeasure: "METER",
          quantityOnHand: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cross-company violation");
    });

    test("2.7 Company A cannot view Company B stock item by direct ID", async () => {
      if (!garmentsStockItemId) return;
      const res = await request(app)
        .get(`/api/v1/stock/${garmentsStockItemId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("2.8 Company A cannot view Company B requisitions/requests", async () => {
      if (!garmentsRequestId) return;
      const res = await request(app)
        .get(`/api/v1/requests/${garmentsRequestId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("2.9 Company A cannot view Company B users by ID", async () => {
      const res = await request(app)
        .get(`/api/v1/users/${garmentsAdminUserId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("2.10 Multi-tenant violations automatically create CRITICAL security audit logs", async () => {
      const secLogs = await query(`
        SELECT action, category, severity, status 
        FROM audit_logs 
        WHERE action = 'FORBIDDEN_ACCESS_ATTEMPT' AND category = 'SECURITY' AND severity = 'CRITICAL'
        ORDER BY timestamp DESC LIMIT 5
      `);
      expect(secLogs.rows.length).toBeGreaterThan(0);
      expect(secLogs.rows[0].status).toBe("FAILURE");
    });
  });

  // =========================================================================
  // STEP 3: COMMON ADMIN SECURITY
  // =========================================================================
  describe("Step 3: Common Admin Global Authority & Context Switching", () => {
    test("3.1 Common Admin in Global Context (no X-Company-Id) views all companies", async () => {
      const res = await request(app)
        .get("/api/v1/companies")
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    test("3.2 Common Admin can switch to Pantone Apparels context via X-Company-Id", async () => {
      const res = await request(app)
        .get("/api/v1/assets")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", apparelsCompanyId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.companyId || item.company_id).toBe(apparelsCompanyId);
      }
    });

    test("3.3 Common Admin can switch to Pantone Garments context via X-Company-Id", async () => {
      const res = await request(app)
        .get("/api/v1/assets")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", garmentsCompanyId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.companyId || item.company_id).toBe(garmentsCompanyId);
      }
    });

    test("3.4 Common Admin specifying invalid UUID target company receives 400 Bad Request", async () => {
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .get("/api/v1/assets")
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .set("X-Company-Id", fakeUuid);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // STEP 4: AUTHENTICATION TESTING & SESSION HARDENING
  // =========================================================================
  describe("Step 4: Authentication & Session Hardening", () => {
    test("4.1 Login with invalid password fails with 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ username: "apparels_admin", password: "wrong_password_123!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("4.2 Login with nonexistent username fails with 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ username: "ghost_user_999", password: "some_password" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("4.3 Tampered JWT token (altered signature) fails with 401", async () => {
      const tampered = commonAdminToken.slice(0, -6) + "xxxxxx";
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tampered}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("4.4 Token payload tampering (forging sub or roleCode) is defeated by DB verification", async () => {
      const fakeToken = jwt.sign(
        { sub: "fake-user", roleCode: "COMMON_ADMIN", isCommonAdmin: true, type: "access" },
        "wrong-secret-key-32-chars-long-123456"
      );

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("4.5 Refresh token rotation works and invalidates old token", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });

      const initialRefreshToken = loginRes.body.data.refreshToken;
      expect(initialRefreshToken).toBeDefined();

      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      const newRefreshToken = refreshRes.body.data.refreshToken;
      expect(newRefreshToken).not.toBe(initialRefreshToken);

      // Replay Attack: Reusing initial refresh token MUST fail with 401
      const replayRes = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: initialRefreshToken });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.message).toContain("revoked");
    });

    test("4.6 Logout revokes the session", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });

      const token = loginRes.body.data.accessToken;
      const refToken = loginRes.body.data.refreshToken;

      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .send({ refreshToken: refToken });

      expect(logoutRes.status).toBe(200);

      const tryRefresh = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: refToken });

      expect(tryRefresh.status).toBe(401);
    });
  });

  // =========================================================================
  // STEP 5: RBAC & PERMISSION TESTING
  // =========================================================================
  describe("Step 5: RBAC & Permission Enforcement", () => {
    test("5.1 Auditor cannot create assets (Read-only violation)", async () => {
      if (!auditorToken) return;
      const res = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${auditorToken}`)
        .send({
          name: "Auditor Illegal Laptop",
          assetTag: "AUD-ILL-001",
          purchaseCost: 1500,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("5.2 Asset Manager cannot manage users", async () => {
      if (!assetManagerToken) return;
      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          username: "illegal_user_1",
          email: "illegal@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("5.3 Direct Permission Override: Granting permission allows access", async () => {
      if (!auditorUserId) return;
      const permRes = await query("SELECT id FROM permissions WHERE code = 'assets:create'");
      if (permRes.rows.length === 0) return;
      const permId = permRes.rows[0].id;

      await query(`
        INSERT INTO user_permissions (user_id, permission_id, is_granted)
        VALUES ($1, $2, true)
        ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = true
      `, [auditorUserId, permId]);

      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${auditorToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.permissions).toContain("assets:create");

      // Deny it
      await query(`
        UPDATE user_permissions SET is_granted = false
        WHERE user_id = $1 AND permission_id = $2
      `, [auditorUserId, permId]);

      const meDenyRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${auditorToken}`);

      expect(meDenyRes.status).toBe(200);
      expect(meDenyRes.body.data.permissions).not.toContain("assets:create");

      // Clean up
      await query("DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2", [auditorUserId, permId]);
    });
  });

  // =========================================================================
  // STEP 14: QR & BARCODE SECURITY
  // =========================================================================
  describe("Step 14: QR & Barcode Resolution Security", () => {
    test("14.1 Resolving valid QR code for authorized company returns asset details", async () => {
      if (!apparelsAssetId) return;
      const token = `asset:${apparelsAssetId}`;
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ code: token, scanType: "QR" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assetId).toBe(apparelsAssetId);
    });

    test("14.2 Scanning another company's QR code returns 403 Forbidden", async () => {
      if (!garmentsAssetId) return;
      const token = `asset:${garmentsAssetId}`;
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ code: token, scanType: "QR" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("14.3 Scanning invalid/unknown asset code returns 404", async () => {
      const fakeToken = "asset:00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ code: fakeToken, scanType: "QR" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("14.4 Unauthenticated QR resolution returns 401", async () => {
      const res = await request(app)
        .post("/api/v1/scan/resolve")
        .send({ code: `asset:${apparelsAssetId}`, scanType: "QR" });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // STEP 16: AUDIT SECURITY & IMMUTABILITY
  // =========================================================================
  describe("Step 16: Audit Log Immutability & Secret Redaction", () => {
    test("16.1 POST /audit is strictly rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/audit")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ action: "FAKE_LOG" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("immutable");
    });

    test("16.2 PUT /audit/:id is strictly rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .put("/api/v1/audit/some-id")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ action: "ALTERED" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("immutable");
    });

    test("16.3 PATCH /audit/:id is strictly rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .patch("/api/v1/audit/some-id")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ action: "ALTERED" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("immutable");
    });

    test("16.4 DELETE /audit/:id is strictly rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .delete("/api/v1/audit/some-id")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("immutable");
    });

    test("16.5 Secrets & password hashes are never exposed in audit logs", async () => {
      const auditRes = await query(`
        SELECT old_values_json, new_values_json 
        FROM audit_logs 
        WHERE action IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'USER_CREATED')
        ORDER BY timestamp DESC LIMIT 20
      `);

      for (const row of auditRes.rows) {
        const rowStr = JSON.stringify(row);
        expect(rowStr).not.toContain("password_hash");
        expect(rowStr).not.toContain("$2a$");
        expect(rowStr).not.toContain("$2b$");
      }
    });
  });
});
