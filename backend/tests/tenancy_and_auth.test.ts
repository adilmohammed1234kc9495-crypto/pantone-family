import request from "supertest";
import { createApp } from "../src/app";
import { pool, query } from "../src/config/database";
import { env } from "../src/config/env";

describe("Phase 1: Authentication, Tenant Isolation & RBAC Integration", () => {
  const app = createApp();

  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  beforeAll(async () => {
    // Fetch company IDs
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // Login Common Admin
    const caLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: "common_admin",
        password: env.SEED_COMMON_ADMIN_PASSWORD
      });
    expect(caLogin.status).toBe(200);
    commonAdminToken = caLogin.body.data.accessToken;

    // Login Apparels Admin
    const appLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: "apparels_admin",
        password: env.SEED_APPARELS_ADMIN_PASSWORD
      });
    expect(appLogin.status).toBe(200);
    apparelsAdminToken = appLogin.body.data.accessToken;

    // Login Garments Admin
    const garLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: "garments_admin",
        password: env.SEED_GARMENTS_ADMIN_PASSWORD
      });
    expect(garLogin.status).toBe(200);
    garmentsAdminToken = garLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await pool.end();
  });

  // Test 10: Tenant context extraction
  test("10. Tenant context extraction must correctly reflect company-scoped authentication", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyId).toBe(apparelsCompanyId);
    expect(res.body.data.companyCode).toBe("PANTONE-APP");
    expect(res.body.data.isCommonAdmin).toBe(false);

    // Garments verification as well
    const garMeRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${garmentsAdminToken}`);

    expect(garMeRes.status).toBe(200);
    expect(garMeRes.body.data.companyId).toBe(garmentsCompanyId);
    expect(garMeRes.body.data.companyCode).toBe("PANTONE-GAR");
  });

  // Test 11: Common Admin context
  test("11. Common Admin context must have global visibility across all companies", async () => {
    // 11a: Common Admin profile check
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.isCommonAdmin).toBe(true);
    expect(meRes.body.data.companyId).toBeNull();

    // 11b: Common Admin can view all companies directory
    const compRes = await request(app)
      .get("/api/v1/companies")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(compRes.status).toBe(200);
    expect(Array.isArray(compRes.body.data)).toBe(true);
    const codes = compRes.body.data.map((c: { code: string }) => c.code);
    expect(codes).toContain("PANTONE-APP");
    expect(codes).toContain("PANTONE-GAR");
  });

  // Test 12: Invalid company access rejection
  test("12. Company user must be strictly rejected from accessing another company's data", async () => {
    // 12a: Apparels user trying to list global companies (Common Admin only endpoint)
    const listRes = await request(app)
      .get("/api/v1/companies")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(listRes.status).toBe(403);
    expect(listRes.body.success).toBe(false);

    // 12b: Apparels user attempting to access Pantone Garments company details
    const garAccessRes = await request(app)
      .get(`/api/v1/companies/${garmentsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(garAccessRes.status).toBe(403);
    expect(garAccessRes.body.message).toContain("Cross-company violation");

    // 12c: Garments user attempting to access Pantone Apparels company details
    const appAccessRes = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${garmentsAdminToken}`);

    expect(appAccessRes.status).toBe(403);
    expect(appAccessRes.body.message).toContain("Cross-company violation");

    // 12d: Apparels user attempting to spoof X-Company-Id header to Garments
    const spoofRes = await request(app)
      .get(`/api/v1/assets/health`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .set("X-Company-Id", garmentsCompanyId);

    expect(spoofRes.status).toBe(403);
    expect(spoofRes.body.message).toContain("Cross-company violation");

    // 12e: Apparels user accessing OWN company details succeeds
    const ownAccessRes = await request(app)
      .get(`/api/v1/companies/${apparelsCompanyId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(ownAccessRes.status).toBe(200);
    expect(ownAccessRes.body.data.code).toBe("PANTONE-APP");
  });
});