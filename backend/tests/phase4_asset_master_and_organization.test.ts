import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";
import { depreciationService } from "../src/modules/assets/depreciation.service";

describe("Phase 4: Asset Master Catalog, Category Hierarchy & Organization Master Data", () => {
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let employeeToken: string;
  let auditorToken: string;

  // Test Entities
  let apparelsBranchId: string;
  let garmentsBranchId: string;
  let testDeptId: string;
  let testLocId: string;
  let testVendorId: string;
  let parentCatId: string;
  let childCatId: string;
  let grandChildCatId: string;
  let testAssetId: string;
  let garmentsAssetId: string;

  beforeAll(async () => {
    // 1. Get core companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Obtain tokens
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

    // 3. Ensure test employee & auditor exist for Apparels
    const empRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId]);
    const audRole = await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId]);
    const pwHash = await hashPassword("TestUser#2026!");

    const audPerms = await query("SELECT id FROM permissions WHERE code IN ('branches:view', 'departments:view', 'locations:view', 'vendors:view', 'categories:view', 'assets:view', 'audit:view')");
    for (const p of audPerms.rows) {
      await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [audRole.rows[0].id, p.id]);
    }

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_p4_emp', 'emp_p4@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [apparelsCompanyId, pwHash, empRole.rows[0].id]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'test_p4_aud', 'aud_p4@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [apparelsCompanyId, pwHash, audRole.rows[0].id]);

    const empLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_p4_emp", password: "TestUser#2026!" });
    employeeToken = empLogin.body.data.accessToken;

    const audLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test_p4_aud", password: "TestUser#2026!" });
    auditorToken = audLogin.body.data.accessToken;
  }, 30000);

  afterAll(async () => {
    // Cleanup test records
    await query("DELETE FROM users WHERE username IN ('test_p4_emp', 'test_p4_aud')");
  });

  // ====================================================================
  // GROUP 1: ORGANIZATION MASTER DATA (Branches, Departments, Locations)
  // ====================================================================

  test("1. Common Admin and Company Admin can create and list branches within company scope", async () => {
    const branchCode = `BR-APP-${Date.now().toString().slice(-4)}`;
    const createRes = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        code: branchCode,
        name: "Apparels Okhla Manufacturing Unit",
        city: "New Delhi",
        state: "Delhi",
        address: "Plot 42, Okhla Phase III",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.code).toBe(branchCode);
    apparelsBranchId = createRes.body.data.id;

    // List branches for Apparels
    const listRes = await request(app)
      .get("/api/v1/branches?search=Okhla")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.branches.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.branches[0].company_id).toBe(apparelsCompanyId);
  });

  test("2. Company Admin cannot access branches of another company (Tenant Scoping)", async () => {
    // Create a Garments branch via Garments Admin
    const garBranchCode = `BR-GAR-${Date.now().toString().slice(-4)}`;
    const garBranchRes = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${garmentsAdminToken}`)
      .send({
        code: garBranchCode,
        name: "Garments Greater Noida Plant",
        city: "Greater Noida",
        state: "Uttar Pradesh",
      });

    expect(garBranchRes.status).toBe(201);
    garmentsBranchId = garBranchRes.body.data.id;

    // Apparels Admin attempts to fetch Garments branch -> 403 Forbidden
    const getRes = await request(app)
      .get(`/api/v1/branches/${garmentsBranchId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.message).toContain("Cross-company violation");
  });

  test("3. Departments CRUD and cross-company branch attachment prevention", async () => {
    // Create valid Department under Apparels branch
    const deptCode = `DEP-${Date.now().toString().slice(-4)}`;
    const createRes = await request(app)
      .post("/api/v1/departments")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        branchId: apparelsBranchId,
        code: deptCode,
        name: "Quality Assurance Division",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe("Quality Assurance Division");
    testDeptId = createRes.body.data.id;

    // Attempt to attach an Apparels department to a Garments branch -> 422/400 ValidationError
    const invalidDeptRes = await request(app)
      .post("/api/v1/departments")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        branchId: garmentsBranchId,
        code: `DEP-INV-${Date.now().toString().slice(-4)}`,
        name: "Invalid Cross-Company Department",
      });

    expect([400, 422]).toContain(invalidDeptRes.status);
    expect(invalidDeptRes.body.message).toContain("Branch does not belong to the selected company");
  });

  test("4. Locations CRUD and cross-company branch attachment prevention", async () => {
    // Create Location under Apparels branch
    const locRes = await request(app)
      .post("/api/v1/locations")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        branchId: apparelsBranchId,
        building: "Block C - Quality Lab",
        floor: "2nd Floor",
        roomNumber: "Lab-204",
        description: "Calibration and inspection lab",
      });

    expect(locRes.status).toBe(201);
    testLocId = locRes.body.data.id;

    // Attempt to attach Location to Garments branch -> 400/422 ValidationError
    const invLocRes = await request(app)
      .post("/api/v1/locations")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        branchId: garmentsBranchId,
        building: "Ghost Building",
      });

    expect([400, 422]).toContain(invLocRes.status);
    expect(invLocRes.body.message).toContain("Branch does not belong to the selected company");
  });

  // ====================================================================
  // GROUP 2: VENDOR MASTER
  // ====================================================================

  test("5. Vendor CRUD with validation, rating, and tenant isolation", async () => {
    const vCode = `VEN-${Date.now().toString().slice(-4)}`;
    const createRes = await request(app)
      .post("/api/v1/vendors")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        code: vCode,
        name: "Singhania Machinery & Tools Pvt Ltd",
        contactPerson: "Rajesh Singhania",
        email: "rajesh@singhaniamachinery.com",
        phone: "+91-9811223344",
        address: "Industrial Area Phase 2, Delhi",
        taxNumber: "07AAACS1234F1Z5",
        rating: 4.8,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe("Singhania Machinery & Tools Pvt Ltd");
    testVendorId = createRes.body.data.id;

    // Duplicate code in same company is rejected with 409 Conflict
    const dupRes = await request(app)
      .post("/api/v1/vendors")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        code: vCode,
        name: "Duplicate Vendor",
      });

    expect(dupRes.status).toBe(409);

    // Garments Admin cannot access this Apparels vendor
    const crossRes = await request(app)
      .get(`/api/v1/vendors/${testVendorId}`)
      .set("Authorization", `Bearer ${garmentsAdminToken}`);

    expect(crossRes.status).toBe(403);
  });

  // ====================================================================
  // GROUP 3: ASSET CATEGORY HIERARCHY
  // ====================================================================

  test("6. Category Hierarchy: multi-level tree creation and circular reference rejection", async () => {
    // 1. Root Category
    const rootCode = `CAT-ROOT-${Date.now().toString().slice(-4)}`;
    const rootRes = await request(app)
      .post("/api/v1/asset-categories")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: rootCode,
        name: "Production Equipment",
        description: "Heavy and light factory manufacturing equipment",
        depreciationMethod: "STRAIGHT_LINE",
        usefulLifeMonths: 120,
        depreciationRatePercent: 10.00,
      });

    expect(rootRes.status).toBe(201);
    parentCatId = rootRes.body.data.id;

    // 2. Child Category
    const childCode = `CAT-CH-${Date.now().toString().slice(-4)}`;
    const childRes = await request(app)
      .post("/api/v1/asset-categories")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: childCode,
        name: "Textile Sewing Machinery",
        parentId: parentCatId,
        usefulLifeMonths: 60,
        depreciationRatePercent: 20.00,
      });

    expect(childRes.status).toBe(201);
    expect(childRes.body.data.parent_id).toBe(parentCatId);
    childCatId = childRes.body.data.id;

    // 3. Grandchild Category
    const grandCode = `CAT-GC-${Date.now().toString().slice(-4)}`;
    const grandRes = await request(app)
      .post("/api/v1/asset-categories")
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        code: grandCode,
        name: "High-Speed Overlock Stitchers",
        parentId: childCatId,
        usefulLifeMonths: 60,
      });

    expect(grandRes.status).toBe(201);
    grandChildCatId = grandRes.body.data.id;

    // 4. Circular Reference Rejection: Attempt to make Root Category child of Grandchild
    const circRes = await request(app)
      .put(`/api/v1/asset-categories/${parentCatId}`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        parentId: grandChildCatId,
      });

    expect([400, 422]).toContain(circRes.status);
    expect(circRes.body.message).toContain("Circular parent category relationship detected");

    // 5. Self-Parenting Rejection: Attempt to make Root Category its own parent
    const selfParentRes = await request(app)
      .put(`/api/v1/asset-categories/${parentCatId}`)
      .set("Authorization", `Bearer ${commonAdminToken}`)
      .send({
        parentId: parentCatId,
      });

    expect([400, 422]).toContain(selfParentRes.status);
    expect(selfParentRes.body.message).toContain("cannot be its own parent");

    // 6. Tree View Verification
    const treeRes = await request(app)
      .get("/api/v1/asset-categories?tree=true")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(treeRes.status).toBe(200);
    expect(Array.isArray(treeRes.body.data)).toBe(true);
    const rootNode = treeRes.body.data.find((c: { id: string; children: unknown[] }) => c.id === parentCatId);
    expect(rootNode).toBeDefined();
    expect(rootNode.children.length).toBeGreaterThanOrEqual(1);
  });

  // ====================================================================
  // GROUP 4: AUTHORITATIVE DEPRECIATION ENGINE (12 Mandatory Tests)
  // ====================================================================

  describe("Depreciation Calculation Engine", () => {
    test("D1. Mandatory 120,000 / 60 months straight-line gives exactly 2,000/month", () => {
      const result = depreciationService.calculate({
        purchaseCost: 120000,
        usefulLifeMonths: 60,
        depreciationMethod: "STRAIGHT_LINE",
        depreciationStartDate: "2026-01-01",
        asOfDate: "2026-01-01",
      });

      expect(result.monthlyDepreciation).toBe(2000);
      expect(result.depreciableAmount).toBe(120000);
      expect(result.usefulLifeMonths).toBe(60);
    });

    test("D2. First month depreciation: 1 month gives 2,000 accumulated, 118,000 book value", () => {
      const result = depreciationService.calculate({
        purchaseCost: 120000,
        usefulLifeMonths: 60,
        depreciationStartDate: "2026-01-01",
        asOfDate: "2026-02-01",
      });

      expect(result.elapsedMonths).toBe(1);
      expect(result.accumulatedDepreciation).toBe(2000);
      expect(result.bookValue).toBe(118000);
      expect(result.isFullyDepreciated).toBe(false);
    });

    test("D3. Multiple months: 12 months gives 24,000 accumulated, 96,000 book value", () => {
      const result = depreciationService.calculate({
        purchaseCost: 120000,
        usefulLifeMonths: 60,
        depreciationStartDate: "2025-01-01",
        asOfDate: "2026-01-01",
      });

      expect(result.elapsedMonths).toBe(12);
      expect(result.accumulatedDepreciation).toBe(24000);
      expect(result.bookValue).toBe(96000);
      expect(result.isFullyDepreciated).toBe(false);
    });

    test("D4. Full useful life: 60 months gives accumulated = 120,000, book value = 0", () => {
      const result = depreciationService.calculate({
        purchaseCost: 120000,
        usefulLifeMonths: 60,
        depreciationStartDate: "2021-01-01",
        asOfDate: "2026-01-01",
      });

      expect(result.elapsedMonths).toBe(60);
      expect(result.accumulatedDepreciation).toBe(120000);
      expect(result.bookValue).toBe(0);
      expect(result.isFullyDepreciated).toBe(true);
    });

    test("D5. Beyond useful life: book value never becomes negative and remains 0", () => {
      const result = depreciationService.calculate({
        purchaseCost: 120000,
        usefulLifeMonths: 60,
        depreciationStartDate: "2019-01-01",
        asOfDate: "2026-01-01", // 84 months elapsed
      });

      expect(result.elapsedMonths).toBe(84);
      expect(result.accumulatedDepreciation).toBe(120000);
      expect(result.bookValue).toBe(0);
      expect(result.isFullyDepreciated).toBe(true);
    });

    test("D6. Zero or negative useful life throws descriptive ValidationError", () => {
      expect(() => {
        depreciationService.calculate({
          purchaseCost: 50000,
          usefulLifeMonths: 0,
        });
      }).toThrow("Useful life must be a positive integer greater than 0");

      expect(() => {
        depreciationService.calculate({
          purchaseCost: 50000,
          usefulLifeMonths: -12,
        });
      }).toThrow("Useful life must be a positive integer greater than 0");
    });

    test("D7. Invalid depreciation method throws descriptive ValidationError", () => {
      expect(() => {
        depreciationService.calculate({
          purchaseCost: 50000,
          usefulLifeMonths: 60,
          depreciationMethod: "DOUBLE_DECLINING",
        });
      }).toThrow("Unsupported depreciation method 'DOUBLE_DECLINING'");
    });

    test("D8. Deterministic rounding (100,000 / 36 months = 2777.78/month)", () => {
      const result = depreciationService.calculate({
        purchaseCost: 100000,
        usefulLifeMonths: 36,
        depreciationStartDate: "2026-01-01",
        asOfDate: "2026-04-01", // 3 months
      });

      expect(result.monthlyDepreciation).toBe(2777.78);
      expect(result.accumulatedDepreciation).toBe(8333.34);
      expect(result.bookValue).toBe(91666.66);
    });

    test("D9. Future depreciation start date gives 0 accumulated and full book value", () => {
      const result = depreciationService.calculate({
        purchaseCost: 75000,
        usefulLifeMonths: 60,
        depreciationStartDate: "2027-01-01",
        asOfDate: "2026-01-01",
      });

      expect(result.elapsedMonths).toBe(0);
      expect(result.accumulatedDepreciation).toBe(0);
      expect(result.bookValue).toBe(75000);
    });

    test("D10. Monthly amortization schedule generation generates correct period entries", () => {
      const schedule = depreciationService.generateSchedule({
        purchaseCost: 12000,
        usefulLifeMonths: 12,
        depreciationStartDate: "2026-01-01",
      });

      expect(schedule.length).toBe(12);
      expect(schedule[0].monthlyDepreciation).toBe(1000);
      expect(schedule[0].accumulatedDepreciation).toBe(1000);
      expect(schedule[0].bookValue).toBe(11000);
      expect(schedule[11].accumulatedDepreciation).toBe(12000);
      expect(schedule[11].bookValue).toBe(0);
    });
  });

  // ====================================================================
  // GROUP 5: ASSET MASTER (Registration, Search, Detail, Depreciation)
  // ====================================================================

  test("7. Asset Registration with auto-numbering, category inheritance, and live valuation", async () => {
    const regRes = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        categoryId: grandChildCatId,
        branchId: apparelsBranchId,
        departmentId: testDeptId,
        locationId: testLocId,
        vendorId: testVendorId,
        name: "Pegasus High-Speed Overlock Stitcher M900",
        serialNumber: "SN-PEG-987654",
        modelNumber: "M900-52-233",
        manufacturer: "Pegasus Sewing Machine Mfg. Co.",
        purchaseDate: "2026-01-15",
        purchaseCost: 120000,
        invoiceNumber: "INV-PEG-2026-001",
        warrantyStart: "2026-01-15",
        warrantyEnd: "2028-01-15",
        condition: "NEW",
        status: "AVAILABLE",
        notes: "Installed in Quality Lab for precision seam testing",
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.asset_tag).toMatch(/^AST-.*-2026-.*/);
    expect(regRes.body.data.barcode).toMatch(/^BAR-AST-.*/);
    expect(regRes.body.data.qr_code).toMatch(/^QR-AST-.*/);
    // Inherited usefulLifeMonths from grandChild category (60 months)
    expect(regRes.body.data.useful_life_months).toBe(60);
    expect(parseFloat(regRes.body.data.purchase_cost)).toBe(120000);
    testAssetId = regRes.body.data.id;
  });

  test("8. Duplicate asset tag is strictly rejected with 409 Conflict", async () => {
    // Attempt to register another asset with the same asset tag
    const existing = await query("SELECT asset_tag FROM assets WHERE id = $1", [testAssetId]);
    const tag = existing.rows[0].asset_tag;

    const dupRes = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        categoryId: grandChildCatId,
        assetTag: tag,
        name: "Duplicate Machine",
        purchaseCost: 50000,
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain("already exists");
  });

  test("9. Asset Search by name, serial, category, and status with pagination", async () => {
    const searchRes = await request(app)
      .get("/api/v1/assets?search=Pegasus&status=AVAILABLE&page=1&limit=10")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.assets.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data.total).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data.assets[0].name).toContain("Pegasus");
    expect(searchRes.body.data.assets[0].company_name).toBe("Pantone Apparels");
  });

  test("10. Asset Detail returns full relational metadata, category details, and calculated depreciation schedule", async () => {
    const detailRes = await request(app)
      .get(`/api/v1/assets/${testAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(testAssetId);
    expect(detailRes.body.data.branch_name).toBe("Apparels Okhla Manufacturing Unit");
    expect(detailRes.body.data.department_name).toBe("Quality Assurance Division");
    expect(detailRes.body.data.vendor_name).toBe("Singhania Machinery & Tools Pvt Ltd");

    // Query depreciation schedule endpoint
    const depRes = await request(app)
      .get(`/api/v1/assets/${testAssetId}/depreciation`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(depRes.status).toBe(200);
    expect(depRes.body.data.calculation.monthlyDepreciation).toBe(2000);
    expect(depRes.body.data.schedule.length).toBe(60);
  });

  test("11. Asset Document and Photo metadata management with safe path traversal protection", async () => {
    // 1. Add valid document
    const docRes = await request(app)
      .post(`/api/v1/assets/${testAssetId}/documents`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        title: "Pegasus M900 User Manual & Schematic",
        documentType: "USER_MANUAL",
        filePath: "pegasus_m900_manual.pdf",
        fileSize: 4500000,
        mimeType: "application/pdf",
      });

    expect(docRes.status).toBe(201);
    expect(docRes.body.data.title).toBe("Pegasus M900 User Manual & Schematic");

    // 2. Reject path traversal attempt
    const traversalRes = await request(app)
      .post(`/api/v1/assets/${testAssetId}/documents`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        title: "Malicious Document",
        documentType: "INVOICE",
        filePath: "../../etc/passwd",
        fileSize: 1024,
        mimeType: "text/plain",
      });

    expect([400, 422]).toContain(traversalRes.status);
    expect(traversalRes.body.message).toContain("Invalid file path");

    // 3. Add primary photo
    const photoRes = await request(app)
      .post(`/api/v1/assets/${testAssetId}/photos`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        photoType: "EQUIPMENT_FRONT",
        filePath: "pegasus_front_view.jpg",
        caption: "Front view of installed stitcher",
        isPrimary: true,
      });

    expect(photoRes.status).toBe(201);
    expect(photoRes.body.data.file_path).toContain("pegasus_front_view.jpg");

    // Verify asset photo_url was updated to primary photo
    const assetCheck = await query("SELECT photo_url FROM assets WHERE id = $1", [testAssetId]);
    expect(assetCheck.rows[0].photo_url).toContain("pegasus_front_view.jpg");
  });

  // ====================================================================
  // GROUP 6: MULTI-TENANT ISOLATION & IDOR
  // ====================================================================

  test("12. Pantone Apparels user cannot view, edit, or delete Pantone Garments assets", async () => {
    // 1. Create a Garments asset via Garments Admin
    const garAssetRes = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${garmentsAdminToken}`)
      .send({
        categoryId: grandChildCatId,
        branchId: garmentsBranchId,
        name: "Garments Brother Buttonhole Machine",
        purchaseCost: 95000,
      });

    expect(garAssetRes.status).toBe(201);
    garmentsAssetId = garAssetRes.body.data.id;

    // 2. Apparels Admin GET Garments asset -> 403 Forbidden
    const getRes = await request(app)
      .get(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.message).toContain("Cross-company violation");

    // 3. Apparels Admin PUT Garments asset -> 403 Forbidden
    const putRes = await request(app)
      .put(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ name: "Hacked Garments Machine" });

    expect(putRes.status).toBe(403);

    // 4. Apparels Admin DELETE Garments asset -> 403 Forbidden
    const delRes = await request(app)
      .delete(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(delRes.status).toBe(403);
  });

  test("13. Non-Common-Admin cannot bypass tenant boundary using X-Company-Id header", async () => {
    const res = await request(app)
      .get("/api/v1/assets")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .set("X-Company-Id", garmentsCompanyId);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Cross-company violation");
  });

  test("14. Common Admin has global visibility across all companies and can filter by company context", async () => {
    // Global list returns assets from both Apparels and Garments
    const globalRes = await request(app)
      .get("/api/v1/assets")
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(globalRes.status).toBe(200);
    const companyIds = new Set(globalRes.body.data.assets.map((a: { company_id: string }) => a.company_id));
    expect(companyIds.has(apparelsCompanyId)).toBe(true);
    expect(companyIds.has(garmentsCompanyId)).toBe(true);

    // Common Admin can view Garments asset specifically
    const detailRes = await request(app)
      .get(`/api/v1/assets/${garmentsAssetId}`)
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.company_id).toBe(garmentsCompanyId);
  });

  // ====================================================================
  // GROUP 7: RBAC ENFORCEMENT & AUDITOR READ-ONLY GUARD
  // ====================================================================

  test("15. Auditor has read-only access and cannot mutate master data or assets", async () => {
    // 1. Auditor CAN read assets
    const getRes = await request(app)
      .get(`/api/v1/assets/${testAssetId}`)
      .set("Authorization", `Bearer ${auditorToken}`);

    expect(getRes.status).toBe(200);

    // 2. Auditor CAN read branches
    const branchRes = await request(app)
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${auditorToken}`);

    expect(branchRes.status).toBe(200);

    // 3. Auditor CANNOT create branch (POST -> 403 Forbidden)
    const postBranch = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ code: "BR-AUD", name: "Auditor Branch" });

    expect(postBranch.status).toBe(403);
    expect(postBranch.body.message).toContain("read-only compliance access");

    // 4. Auditor CANNOT create asset (POST -> 403 Forbidden)
    const postAsset = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ categoryId: grandChildCatId, name: "Auditor Machine", purchaseCost: 1000 });

    expect(postAsset.status).toBe(403);

    // 5. Auditor CANNOT update asset (PUT -> 403 Forbidden)
    const putAsset = await request(app)
      .put(`/api/v1/assets/${testAssetId}`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ name: "Auditor Altered Name" });

    expect(putAsset.status).toBe(403);

    // 6. Ordinary Employee CANNOT create asset (POST -> 403 Forbidden)
    const postEmp = await request(app)
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ categoryId: grandChildCatId, name: "Employee Machine", purchaseCost: 1000 });

    expect(postEmp.status).toBe(403);
  });

  // ====================================================================
  // GROUP 8: STRUCTURED AUDIT LOGGING VERIFICATION
  // ====================================================================

  test("16. Master data and asset mutations generate structured audit log entries", async () => {
    const auditRes = await query(`
      SELECT action, entity, entity_id, new_values_json
      FROM audit_logs
      WHERE action IN (
        'BRANCH_CREATE', 'DEPARTMENT_CREATE', 'LOCATION_CREATE',
        'VENDOR_CREATE', 'CATEGORY_CREATE', 'ASSET_CREATE',
        'ASSET_DOCUMENT_UPLOAD', 'ASSET_PHOTO_UPLOAD'
      )
      ORDER BY timestamp DESC
      LIMIT 20
    `);

    const actions = new Set(auditRes.rows.map((r) => r.action));
    expect(actions.has("BRANCH_CREATE")).toBe(true);
    expect(actions.has("DEPARTMENT_CREATE")).toBe(true);
    expect(actions.has("LOCATION_CREATE")).toBe(true);
    expect(actions.has("VENDOR_CREATE")).toBe(true);
    expect(actions.has("CATEGORY_CREATE")).toBe(true);
    expect(actions.has("ASSET_CREATE")).toBe(true);
    expect(actions.has("ASSET_DOCUMENT_UPLOAD")).toBe(true);
    expect(actions.has("ASSET_PHOTO_UPLOAD")).toBe(true);
  });
});
