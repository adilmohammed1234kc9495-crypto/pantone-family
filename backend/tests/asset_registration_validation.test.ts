import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";

describe("Regression: Asset Registration Validation & Multi-Tenant Integrity", () => {
  const app = createApp();

  let aslamToken: string;
  let apparelsToken: string;
  let apparelsCompanyId: string;
  let garmentsCompanyId: string;
  let vehCategoryId: string;
  let apparelsBranchId: string;

  beforeAll(async () => {
    // 1. Get companies
    const compRes = await query("SELECT id, code FROM companies");
    for (const c of compRes.rows) {
      if (c.code === "PANTONE-APP") apparelsCompanyId = c.id;
      if (c.code === "PANTONE-GAR") garmentsCompanyId = c.id;
    }

    // 2. Authenticate Aslam & Apparels Admin
    const aslamLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "aslam", password: "pantone123" });
    expect(aslamLogin.status).toBe(200);
    aslamToken = aslamLogin.body.data.accessToken;

    const apparelsLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "apparels", password: "pantone123" });
    expect(apparelsLogin.status).toBe(200);
    apparelsToken = apparelsLogin.body.data.accessToken;

    // 3. Find VEH category
    const catRes = await query("SELECT id, code, name FROM asset_categories WHERE code = 'VEH'");
    expect(catRes.rows.length).toBeGreaterThan(0);
    vehCategoryId = catRes.rows[0].id;

    // 4. Find branch for Apparels
    const branchRes = await query("SELECT id FROM branches WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
    expect(branchRes.rows.length).toBeGreaterThan(0);
    apparelsBranchId = branchRes.rows[0].id;
  });

  test("1. Categories load from real backend with full metadata", async () => {
    const res = await request(app)
      .get("/api/v1/categories?limit=50")
      .set("Authorization", `Bearer ${aslamToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const categories = res.body.data.categories;
    expect(Array.isArray(categories)).toBe(true);
    const vehCat = categories.find((c: any) => c.code === "VEH");
    expect(vehCat).toBeDefined();
    expect(vehCat.name).toContain("Logistics & Transport");
    expect(vehCat.depreciation_method).toBe("STRAIGHT_LINE");
  });

  test("2. A valid asset can be registered with category VEH by Common Admin", async () => {
    const customTag = `VEH-TEST-${Date.now()}`;
    const payload = {
      companyId: apparelsCompanyId,
      branchId: apparelsBranchId,
      categoryId: vehCategoryId,
      assetTag: customTag,
      name: "Isuzu 5-Ton Delivery Truck",
      purchaseDate: "2026-10-12",
      purchaseCost: 85000,
      currency: "USD",
      salvageValue: 5000,
      condition: "NEW",
      depreciationMethod: "STRAIGHT_LINE",
      depreciationRatePercent: 20,
      usefulLifeMonths: 60,
      depreciationStartDate: "2026-10-12",
    };

    const res = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${aslamToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Isuzu 5-Ton Delivery Truck");
    expect(res.body.data.asset_tag).toBe(customTag);
    expect(res.body.data.category_id).toBe(vehCategoryId);
    expect(res.body.data.company_id).toBe(apparelsCompanyId);

    // 3. Verify asset is persisted in PostgreSQL
    const dbCheck = await query("SELECT * FROM assets WHERE id = $1", [res.body.data.id]);
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].name).toBe("Isuzu 5-Ton Delivery Truck");
    expect(dbCheck.rows[0].company_id).toBe(apparelsCompanyId);
  });

  test("3. A valid asset can be registered by Company Admin with auto-tagging and condition aliases", async () => {
    const payload = {
      branchId: apparelsBranchId,
      categoryId: vehCategoryId,
      name: "Tata Ace EV Commercial Shuttle",
      purchaseDate: "2026-10-12",
      purchaseCost: 24000,
      condition: "POOR", // Should be accepted & normalized to DAMAGED
      notes: "Commercial delivery fleet unit",
    };

    const res = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.condition).toBe("DAMAGED");
    expect(res.body.data.asset_tag).toMatch(/^AST-.*-2026-.*/);
    expect(res.body.data.company_id).toBe(apparelsCompanyId);

    // 4. Saved asset appears in the asset list
    const listRes = await request(app)
      .get(`/api/v1/assets?search=${encodeURIComponent("Tata Ace EV")}`)
      .set("Authorization", `Bearer ${apparelsToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.assets.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.assets[0].name).toContain("Tata Ace EV");
  });

  test("5. Duplicate asset tags are rejected with 409 Conflict", async () => {
    const duplicateTag = `DUP-TAG-${Date.now()}`;
    const payload1 = {
      branchId: apparelsBranchId,
      categoryId: vehCategoryId,
      assetTag: duplicateTag,
      name: "Fleet Vehicle Original",
      purchaseCost: 30000,
    };

    const res1 = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsToken}`)
      .send(payload1);
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsToken}`)
      .send({ ...payload1, name: "Fleet Vehicle Duplicate Copy" });

    expect(res2.status).toBe(409);
    expect(res2.body.message).toContain("already exists");
  });

  test("6. Failures produce understandable field-level error messages", async () => {
    const invalidPayload = {
      branchId: "invalid-uuid",
      categoryId: "not-a-uuid",
      name: "", // Too short
      purchaseCost: -500, // Negative cost
    };

    const res = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsToken}`)
      .send(invalidPayload);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Request validation failed");
    expect(res.body.error.details.fieldErrors).toBeDefined();
    expect(res.body.error.details.fieldErrors.branchId).toBeDefined();
    expect(res.body.error.details.fieldErrors.categoryId).toBeDefined();
    expect(res.body.error.details.fieldErrors.name).toBeDefined();
    expect(res.body.error.details.fieldErrors.purchaseCost).toBeDefined();
  });

  test("7. Tenant isolation: Company Admin cannot register an asset for another company", async () => {
    // Apparels admin attempting to create asset with Garments branch
    const garBranchRes = await query("SELECT id FROM branches WHERE company_id = $1 LIMIT 1", [garmentsCompanyId]);
    if (garBranchRes.rows.length > 0) {
      const garBranchId = garBranchRes.rows[0].id;
      const attackPayload = {
        branchId: garBranchId,
        categoryId: vehCategoryId,
        name: "Intrusion Attempt Vehicle",
        purchaseCost: 50000,
      };

      const res = await request(app)
        .post("/api/v1/assets")
        .set("Authorization", `Bearer ${apparelsToken}`)
        .send(attackPayload);

      expect(res.status).toBe(422);
      expect(res.body.message).toContain("does not belong to the selected company");
    }
  });
});
