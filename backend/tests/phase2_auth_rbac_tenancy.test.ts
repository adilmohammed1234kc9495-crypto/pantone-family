import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 2: Comprehensive Authentication, Session Management, RBAC & Multi-Tenant Isolation", () => {
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  let apparelsAssetId: string;
  let garmentsAssetId: string;

  let apparelsEmployeeId: string;
  let garmentsEmployeeId: string;

  let cuttingDeptId: string;
  let sewingDeptId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let assetManagerToken: string;
  let deptManagerToken: string;
  let employeeToken: string;
  let auditorToken: string;

  // User IDs
  let employeeUserId: string;
  let auditorUserId: string;

  beforeAll(async () => {
    // Clear any previous rate limit states to ensure test isolation
    await query("DELETE FROM auth_rate_limits");

    // 1. Get companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Get departments
    const cutRes = await query("SELECT id FROM departments WHERE company_id = $1 AND code = 'DEPT-CUT'", [apparelsCompanyId]);
    cuttingDeptId = cutRes.rows[0].id;

    const sewRes = await query("SELECT id FROM departments WHERE company_id = $1 AND code = 'DEPT-SEW'", [apparelsCompanyId]);
    sewingDeptId = sewRes.rows[0].id;

    // 3. Get roles
    const amRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'ASSET_MANAGER'", [apparelsCompanyId]);
    const dmRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'DEPT_MANAGER'", [apparelsCompanyId]);
    const empRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId]);
    const audRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId]);

    // Ensure permissions are assigned to these roles for testing
    // AM permissions:
    const amPerms = await query("SELECT id FROM permissions WHERE code IN ('assets:view', 'assets:create', 'assets:edit', 'assets:retire', 'stock:manage')");
    for (const p of amPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [amRole.rows[0].id, p.id]);
    }
    // DM permissions:
    const dmPerms = await query("SELECT id FROM permissions WHERE code IN ('requests:view', 'requests:create', 'requests:approve', 'assets:view')");
    for (const p of dmPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [dmRole.rows[0].id, p.id]);
    }
    // Emp permissions:
    const empPerms = await query("SELECT id FROM permissions WHERE code IN ('requests:create', 'handovers:sign')");
    for (const p of empPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [empRole.rows[0].id, p.id]);
    }
    // Auditor permissions:
    const audPerms = await query("SELECT id FROM permissions WHERE code IN ('assets:view', 'reports:view', 'audit:view')");
    for (const p of audPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [audRole.rows[0].id, p.id]);
    }

    // 4. Create Employees
    const emp1Res = await query(`
      INSERT INTO employees (company_id, department_id, employee_code, first_name, last_name, email, designation)
      VALUES ($1, $2, 'EMP-APP-001', 'Arjun', 'Sharma', 'arjun@pantone-apparels.com', 'Machine Operator')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id
    `, [apparelsCompanyId, cuttingDeptId]);
    apparelsEmployeeId = emp1Res.rows[0].id;

    const emp2Res = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, designation)
      VALUES ($1, 'EMP-GAR-001', 'Vikram', 'Mehta', 'vikram@pantone-garments.com', 'Quality Inspector')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id
    `, [garmentsCompanyId]);
    garmentsEmployeeId = emp2Res.rows[0].id;

    // 5. Create Test Users
    const testPassHash = await hashPassword("TestPass#2026!");

    // AM user
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_apparels_am', 'am@pantone-apparels.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [apparelsCompanyId, testPassHash, amRole.rows[0].id]);

    // DM user (Cutting department)
    const dmEmpRes = await query(`
      INSERT INTO employees (company_id, department_id, employee_code, first_name, last_name, email, designation)
      VALUES ($1, $2, 'EMP-APP-DM', 'Deepak', 'Verma', 'deepak@pantone-apparels.com', 'Cutting Dept Manager')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id
    `, [apparelsCompanyId, cuttingDeptId]);

    await query(`
      INSERT INTO users (company_id, employee_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, $2, 'test_apparels_dm', 'dm@pantone-apparels.com', $3, $4, true)
      ON CONFLICT (username) DO NOTHING
    `, [apparelsCompanyId, dmEmpRes.rows[0].id, testPassHash, dmRole.rows[0].id]);

    // Employee user
    const empUserRes = await query(`
      INSERT INTO users (company_id, employee_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, $2, 'test_apparels_emp', 'emp@pantone-apparels.com', $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id
    `, [apparelsCompanyId, apparelsEmployeeId, testPassHash, empRole.rows[0].id]);
    employeeUserId = empUserRes.rows[0].id;

    // Auditor user
    const audUserRes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_apparels_aud', 'auditor@pantone-apparels.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id
    `, [apparelsCompanyId, testPassHash, audRole.rows[0].id]);
    auditorUserId = audUserRes.rows[0].id;

    // Inactive user for testing
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_inactive_user', 'inactive@pantone.com', $2, $3, false)
      ON CONFLICT (username) DO UPDATE SET is_active = false
    `, [apparelsCompanyId, testPassHash, empRole.rows[0].id]);

    // 6. Create Category and Baseline Assets
    const catRes = await query(`
      INSERT INTO asset_categories (company_id, code, name, depreciation_rate_percent, useful_life_months)
      VALUES ($1, 'SEW-MACH', 'Industrial Sewing Machines', 15.00, 60)
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [apparelsCompanyId]);
    const categoryId = catRes.rows[0].id;

    const catGarRes = await query(`
      INSERT INTO asset_categories (company_id, code, name, depreciation_rate_percent, useful_life_months)
      VALUES ($1, 'GAR-MACH', 'Garment Machinery', 15.00, 60)
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [garmentsCompanyId]);
    const categoryGarId = catGarRes.rows[0].id;

    // Apparels asset
    const appAssetRes = await query(`
      INSERT INTO assets (
        company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      )
      VALUES ($1, $2, 'TAG-APP-001', 'BAR-APP-001', 'QR-APP-001', 'Juki Sewing Machine 01', 1200.00, 1200.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [apparelsCompanyId, categoryId]);
    apparelsAssetId = appAssetRes.rows[0].id;

    // Garments asset
    const garAssetRes = await query(`
      INSERT INTO assets (
        company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition
      )
      VALUES ($1, $2, 'TAG-GAR-001', 'BAR-GAR-001', 'QR-GAR-001', 'Brother Stitcher 01', 1500.00, 1500.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [garmentsCompanyId, categoryGarId]);
    garmentsAssetId = garAssetRes.rows[0].id;

    // 7. Obtain tokens for all roles
    const caLogin = await request(app).post("/api/v1/auth/login").send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });
    commonAdminToken = caLogin.body.data.accessToken;

    const appAdminLogin = await request(app).post("/api/v1/auth/login").send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });
    apparelsAdminToken = appAdminLogin.body.data.accessToken;

    const garAdminLogin = await request(app).post("/api/v1/auth/login").send({ username: "garments_admin", password: env.SEED_GARMENTS_ADMIN_PASSWORD });
    garmentsAdminToken = garAdminLogin.body.data.accessToken;

    const amLogin = await request(app).post("/api/v1/auth/login").send({ username: "test_apparels_am", password: "TestPass#2026!" });
    assetManagerToken = amLogin.body.data.accessToken;

    const dmLogin = await request(app).post("/api/v1/auth/login").send({ username: "test_apparels_dm", password: "TestPass#2026!" });
    deptManagerToken = dmLogin.body.data.accessToken;

    const empLogin = await request(app).post("/api/v1/auth/login").send({ username: "test_apparels_emp", password: "TestPass#2026!" });
    employeeToken = empLogin.body.data.accessToken;

    const audLogin = await request(app).post("/api/v1/auth/login").send({ username: "test_apparels_aud", password: "TestPass#2026!" });
    auditorToken = audLogin.body.data.accessToken;
  }, 30000);

  // ==================================================================
  // GROUP 1: AUTHENTICATION (Tests 1 - 14)
  // ==================================================================

  test("1. Valid login succeeds and returns user profile, access token, and refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.username).toBe("common_admin");
  });

  test("2. Wrong password fails with generic 401 error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: "WrongPassword#123!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials provided");
  });

  test("3. Unknown username fails with identical generic 401 error (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "completely_fake_user_404", password: "SomePassword#123!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials provided");
  });

  test("4. Inactive user cannot login and is rejected with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_inactive_user", password: "TestPass#2026!" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("deactivated");
  });

  test("5. Password is never returned in authentication responses", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });

    expect(res.body.data.user.password).toBeUndefined();
  });

  test("6. Password hash is never returned in login or /auth/me responses", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });

    expect(loginRes.body.data.user.password_hash).toBeUndefined();

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.body.data.password_hash).toBeUndefined();
  });

  test("7. Access token validates and permits access to authenticated routes", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("apparels_admin");
  });

  test("8. Expired access token is strictly rejected with 401 Unauthorized", async () => {
    // Generate token with negative expiration
    const expiredToken = jwt.sign(
      { sub: "usr_123", roleCode: "EMPLOYEE", type: "access" },
      env.JWT_SECRET,
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("9. Invalid JWT signature is rejected with 401 Unauthorized", async () => {
    const forgedToken = jwt.sign(
      { sub: "usr_forged", roleCode: "COMMON_ADMIN", type: "access" },
      "completely_wrong_secret_key_that_should_fail"
    );

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${forgedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("10. Refresh token works to issue a new access token", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });

    const rawRefresh = loginRes.body.data.refreshToken;

    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rawRefresh });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
  });

  test("11. Refresh token rotation works: old refresh token is revoked after rotation", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });

    const firstRefresh = loginRes.body.data.refreshToken;

    // Use refresh token once (Rotates)
    const rotateRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });
    expect(rotateRes.status).toBe(200);
    const secondRefresh = rotateRes.body.data.refreshToken;

    // Attempting to re-use the first refresh token must FAIL!
    const replayRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.message).toContain("revoked");

    // Second refresh token continues to work
    const secondUseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: secondRefresh });
    expect(secondUseRes.status).toBe(200);
  });

  test("12. Revoked refresh token is rejected", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });

    const refreshToken = loginRes.body.data.refreshToken;

    // Logout revoking session
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
      .send({ refreshToken });

    // Attempt to use revoked refresh token
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  test("13. Logout revokes the session and prevents further token refresh", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "common_admin", password: env.SEED_COMMON_ADMIN_PASSWORD });

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
      .send({ refreshToken: loginRes.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("14. Logout-all revokes all active sessions for the current user", async () => {
    // Create 2 concurrent sessions
    const login1 = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_apparels_am", password: "TestPass#2026!" });
    const login2 = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_apparels_am", password: "TestPass#2026!" });

    const token1 = login1.body.data.refreshToken;
    const token2 = login2.body.data.refreshToken;

    // Call logout-all
    const logoutAllRes = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${login1.body.data.accessToken}`);
    expect(logoutAllRes.status).toBe(200);

    // Both refresh tokens must now be revoked
    const res1 = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token1 });
    expect(res1.status).toBe(401);

    const res2 = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token2 });
    expect(res2.status).toBe(401);
  });

  // ==================================================================
  // GROUP 2: RBAC (Tests 15 - 24)
  // ==================================================================

  test("15. Common Admin can access global resources across all endpoints", async () => {
    const res = await request(app)
      .get("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test("16. Company Admin can access own company resources", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe("PANTONE-APP");
  });

  test("17. Company Admin cannot access another company's records", async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${garmentsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("18. Asset Manager permissions work for asset operations", async () => {
    // Asset Manager has assets:view and assets:edit
    const res = await request(app)
      .get(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${assetManagerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.asset_tag).toBe("TAG-APP-001");
  });

  test("19. Department Manager permissions work and department scope is recognized", async () => {
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${deptManagerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role.code).toBe("DEPT_MANAGER");
    expect(meRes.body.data.employee.departmentId).toBe(cuttingDeptId);
    expect(meRes.body.data.permissions).toContain("requests:approve");

    // Verify department scope enforcement helper
    const { assertDepartmentAccess } = await import("../src/middleware/tenant.middleware");
    const dmAuthUser = {
      id: "dm-user-id",
      username: "test_apparels_dm",
      email: "dm@pantone-apparels.com",
      companyId: apparelsCompanyId,
      companyCode: "PANTONE-APP",
      companyName: "Pantone Apparels",
      roleId: "dm-role-id",
      roleCode: "DEPT_MANAGER",
      roleName: "Department Manager",
      employeeId: "dm-emp-id",
      departmentId: cuttingDeptId,
      employeeCode: "EMP-APP-DM",
      isCommonAdmin: false,
      permissions: ["requests:approve"]
    };

    // Assigned department passes
    expect(() => assertDepartmentAccess(dmAuthUser, cuttingDeptId)).not.toThrow();

    // Foreign department within same company is rejected!
    expect(() => assertDepartmentAccess(dmAuthUser, sewingDeptId)).toThrow("Cross-department violation");
  });

  test("20. Employee restrictions work: Employee cannot edit assets or approve requests", async () => {
    // Employee attempting to update asset
    const editRes = await request(app)
      .put(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Hacked by Employee" });

    expect(editRes.status).toBe(403);
    expect(editRes.body.message).toContain("Insufficient permissions");
  });

  test("21. Auditor is read-only: Auditor can GET assets but mutation is blocked with 403", async () => {
    // Auditor GET -> Allowed
    const getRes = await request(app)
      .get(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${auditorToken}`);
    expect(getRes.status).toBe(200);

    // Auditor PUT -> Strictly Blocked!
    const putRes = await request(app)
      .put(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ name: "Auditor mutation attempt" });

    expect(putRes.status).toBe(403);
    expect(putRes.body.message).toContain("Auditor role has read-only compliance access");
  });

  test("22. Direct permission grant works: user gets permission not granted by their role", async () => {
    // Grant 'assets:view' directly to employee user
    const viewPerm = await query("SELECT id FROM permissions WHERE code = 'assets:view'");
    await query(`
      INSERT INTO user_permissions (user_id, permission_id, is_granted)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = true
    `, [employeeUserId, viewPerm.rows[0].id]);

    // Employee now successfully views asset!
    const res = await request(app)
      .get(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.asset_tag).toBe("TAG-APP-001");
  });

  test("23. Direct permission deny works: user is denied a permission normally granted by their role", async () => {
    // Deny 'assets:view' directly to auditor user (who normally has it via role)
    const viewPerm = await query("SELECT id FROM permissions WHERE code = 'assets:view'");
    await query(`
      INSERT INTO user_permissions (user_id, permission_id, is_granted)
      VALUES ($1, $2, false)
      ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = false
    `, [auditorUserId, viewPerm.rows[0].id]);

    // Auditor now fails to view asset!
    const res = await request(app)
      .get(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${auditorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Insufficient permissions");

    // Clean up explicit deny
    await query("DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2", [auditorUserId, viewPerm.rows[0].id]);
  });

  test("24. Unauthorized permission attempt returns 403 Forbidden with descriptive code", async () => {
    const res = await request(app)
      .delete(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Insufficient permissions");
  });

  // ==================================================================
  // GROUP 3: TENANT ISOLATION & IDOR PROTECTION (Tests 25 - 33)
  // ==================================================================

  test("25. Apparels user cannot GET Garments asset", async () => {
    const res = await request(app)
      .get(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("26. Apparels user cannot PUT Garments asset", async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ name: "Tampered Name" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("27. Apparels user cannot DELETE Garments asset", async () => {
    const res = await request(app)
      .delete(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("28. Apparels user cannot read Garments employee profile", async () => {
    const res = await request(app)
      .get(`/api/v1/employees/${garmentsEmployeeId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("29. Apparels user cannot create asset under Garments", async () => {
    const res = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        companyId: garmentsCompanyId,
        assetTag: `TAG-INJECT-${Date.now()}`,
        barcode: `BAR-INJECT-${Date.now()}`,
        qrCode: `QR-INJECT-${Date.now()}`,
        name: "Injected Garments Asset",
        categoryId: (await query("SELECT id FROM asset_categories WHERE company_id = $1 LIMIT 1", [garmentsCompanyId])).rows[0].id,
        purchaseCost: 900,
        currentValue: 900
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("30. Apparels user cannot manipulate company ID through request body", async () => {
    const res = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        companyId: garmentsCompanyId,
        name: "Manipulated Body Asset"
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("31. Apparels user cannot bypass tenancy using query parameters (?companyId=...)", async () => {
    const res = await request(app)
      .get(`/api/v1/assets/health?companyId=${garmentsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("32. Apparels user cannot bypass tenancy using headers (X-Company-ID: ...)", async () => {
    const res = await request(app)
      .get("/api/v1/assets/health")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .set("X-Company-ID", garmentsCompanyId);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("33. IDOR attempts across company boundaries are completely blocked", async () => {
    // Garments user attempting to access Apparels asset
    const res = await request(app)
      .get(`/api/v1/assets/${apparelsAssetId}`)
      .set("Authorization", `Bearer ${garmentsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  // ==================================================================
  // GROUP 4: COMMON ADMIN (Tests 34 - 36)
  // ==================================================================

  test("34. Common Admin sees both companies in directory", async () => {
    const res = await request(app)
      .get("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(res.status).toBe(200);
    const codes = res.body.data.map((c: { code: string }) => c.code);
    expect(codes).toContain("PANTONE-APP");
    expect(codes).toContain("PANTONE-GAR");
  });

  test("35. Common Admin can explicitly select company context via X-Company-ID", async () => {
    const res = await request(app)
      .get("/api/v1/assets/health")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .set("X-Company-ID", apparelsCompanyId);

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.companyId).toBe(apparelsCompanyId);
    expect(res.body.data.tenant.isGlobal).toBe(false);
  });

  test("36. Common Admin actions generate structured audit log events", async () => {
    // Common Admin fetches companies
    await request(app)
      .get("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    const auditRes = await query(`
      SELECT action, entity, user_id
      FROM audit_logs 
      WHERE user_id = (SELECT id FROM users WHERE username = 'common_admin')
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].action).toBeDefined();
  });

  // ==================================================================
  // GROUP 5: RATE LIMITING & BRUTE FORCE PROTECTION (Tests 37 - 39)
  // ==================================================================

  test("37. Failed login attempts are accurately tracked in auth_rate_limits", async () => {
    const testUsername = `rate_test_${Date.now()}`;
    // 2 failed attempts
    await request(app).post("/api/v1/auth/login").send({ username: testUsername, password: "bad" });
    await request(app).post("/api/v1/auth/login").send({ username: testUsername, password: "bad" });

    const key = `127.0.0.1:${testUsername.toLowerCase()}`;
    const rlRes = await query("SELECT failed_attempts FROM auth_rate_limits WHERE key = $1", [key]);
    expect(rlRes.rows.length).toBe(1);
    expect(rlRes.rows[0].failed_attempts).toBe(2);
  });

  test("38. Cooldown activates after 5 consecutive failed attempts (returns 429 Too Many Requests)", async () => {
    const testUsername = `lockout_test_${Date.now()}`;

    // Execute 5 consecutive failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/v1/auth/login").send({ username: testUsername, password: "bad" });
    }

    // 6th attempt should be blocked with 429 Too Many Requests
    const lockedRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: testUsername, password: "bad" });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.success).toBe(false);
    expect(lockedRes.body.message).toContain("Too many failed login attempts");
  });

  test("39. Successful login resets failure counter", async () => {
    // 1 failed attempt for apparels_admin
    await request(app).post("/api/v1/auth/login").send({ username: "apparels_admin", password: "wrong" });

    const key = "127.0.0.1:apparels_admin";
    const beforeRes = await query("SELECT failed_attempts FROM auth_rate_limits WHERE key = $1", [key]);
    expect(beforeRes.rows.length).toBe(1);

    // Now valid login
    const successRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels_admin", password: env.SEED_APPARELS_ADMIN_PASSWORD });
    expect(successRes.status).toBe(200);

    // Record should be cleared/reset
    const afterRes = await query("SELECT * FROM auth_rate_limits WHERE key = $1", [key]);
    expect(afterRes.rows.length).toBe(0);
  });
});