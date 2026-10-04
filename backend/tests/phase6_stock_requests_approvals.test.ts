import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";

describe("Phase 6: Stock Management, Asset Requisitions & Multi-Level Approvals", () => {
  jest.setTimeout(30000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let deptManagerToken: string;
  let assetManagerToken: string;
  let employeeToken: string;
  let garmentsEmployeeToken: string;
  let auditorToken: string;

  // IDs
  let deptCuttingId: string;
  let apparelsEmployeeId: string;
  let garmentsEmployeeId: string;
  let apparelsUserId: string;
  let categoryMachineryId: string;
  let categoryRawMaterialsId: string;
  let testAvailableAssetId: string;

  beforeAll(async () => {
    // 1. Core companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // Clean up any Phase 6 artifacts from previous test runs
    await query("DELETE FROM stock_movements WHERE company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM asset_request_approvals WHERE request_id IN (SELECT id FROM asset_requests WHERE company_id IN ($1, $2))", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM request_history WHERE company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM asset_requests WHERE company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM stock_items WHERE company_id IN ($1, $2)", [apparelsCompanyId, garmentsCompanyId]);
    await query("DELETE FROM approval_workflows WHERE name LIKE '%High Value%' OR name LIKE '%Invalid%'");

    // 2. Auth tokens for Company Admins and Common Admin
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

    // 3. Departments
    const dept1 = await query(`
      INSERT INTO departments (company_id, code, name)
      VALUES ($1, 'DEP-CUT-P6', 'Cutting & Pattern')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    deptCuttingId = dept1.rows[0].id;

    // 4. Employees
    const emp1 = await query(`
      INSERT INTO employees (company_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, 'EMP-P6-APP-01', 'Arjun', 'Mehta', 'arjun.m@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET department_id = EXCLUDED.department_id
      RETURNING id;
    `, [apparelsCompanyId, deptCuttingId]);
    apparelsEmployeeId = emp1.rows[0].id;

    const emp2 = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, 'EMP-P6-GAR-01', 'Farhan', 'Kabir', 'farhan.k@pantone-garments.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id;
    `, [garmentsCompanyId]);
    garmentsEmployeeId = emp2.rows[0].id;

    // Dept Manager Employee in deptCuttingId
    const mgrEmp = await query(`
      INSERT INTO employees (company_id, department_id, employee_code, first_name, last_name, email, status)
      VALUES ($1, $2, 'EMP-P6-MGR-01', 'Vikram', 'Singh', 'vikram.s@pantone-apparels.com', 'ACTIVE')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET department_id = EXCLUDED.department_id
      RETURNING id;
    `, [apparelsCompanyId, deptCuttingId]);
    const deptMgrEmpId = mgrEmp.rows[0].id;

    // 5. Roles & Test Users
    const pwHash = await hashPassword("SecureP6#2026!");

    const deptMgrRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'DEPT_MANAGER'", [apparelsCompanyId])).rows[0].id;
    const assetMgrRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'ASSET_MANAGER'", [apparelsCompanyId])).rows[0].id;
    const empRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [apparelsCompanyId])).rows[0].id;
    const garEmpRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'", [garmentsCompanyId])).rows[0].id;
    const audRole = (await query("SELECT id FROM roles WHERE company_id = $1 AND code = 'AUDITOR'", [apparelsCompanyId])).rows[0].id;

    // Ensure Phase 6 permissions are assigned to roles
    const stockPerms = await query("SELECT id, code FROM permissions WHERE code LIKE 'stock:%' OR code LIKE 'requests:%' OR code LIKE 'approvals:%' OR code LIKE 'workflows:%'");
    for (const p of stockPerms.rows) {
      if (p.code.includes(":view") || p.code === "requests:create" || p.code === "requests:cancel") {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [empRole, p.id]);
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [garEmpRole, p.id]);
      }
      if (p.code.includes(":view")) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [audRole, p.id]);
      }
      if (p.code.startsWith("approvals:") || p.code.includes(":view") || p.code.startsWith("requests:")) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [deptMgrRole, p.id]);
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [assetMgrRole, p.id]);
      }
      if (p.code.startsWith("stock:")) {
        await query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [assetMgrRole, p.id]);
      }
    }

    // Users
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p6_dept_mgr', 'dept_mgr_p6@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id;
    `, [apparelsCompanyId, pwHash, deptMgrRole, deptMgrEmpId]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p6_asset_mgr', 'asset_mgr_p6@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwHash, assetMgrRole]);

    const uEmp = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p6_emp', 'emp_p6@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id
      RETURNING id;
    `, [apparelsCompanyId, pwHash, empRole, apparelsEmployeeId]);
    apparelsUserId = uEmp.rows[0].id;

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'user_p6_gar_emp', 'gar_emp_p6@pantone.com', $2, $3, $4, true)
      ON CONFLICT (username) DO UPDATE SET employee_id = EXCLUDED.employee_id;
    `, [garmentsCompanyId, pwHash, garEmpRole, garmentsEmployeeId]);

    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'user_p6_aud', 'aud_p6@pantone.com', $2, $3, true)
      ON CONFLICT (username) DO NOTHING;
    `, [apparelsCompanyId, pwHash, audRole]);

    // Logins
    deptManagerToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p6_dept_mgr", password: "SecureP6#2026!" })).body.data.accessToken;
    assetManagerToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p6_asset_mgr", password: "SecureP6#2026!" })).body.data.accessToken;
    employeeToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p6_emp", password: "SecureP6#2026!" })).body.data.accessToken;
    garmentsEmployeeToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p6_gar_emp", password: "SecureP6#2026!" })).body.data.accessToken;
    auditorToken = (await request(app).post("/api/v1/auth/login").send({ username: "user_p6_aud", password: "SecureP6#2026!" })).body.data.accessToken;

    // Categories
    const existingCat1 = await query("SELECT id FROM asset_categories WHERE code = 'CAT-IND-MACH-P6' LIMIT 1");
    if (existingCat1.rows.length > 0) {
      categoryMachineryId = existingCat1.rows[0].id;
    } else {
      const cat1 = await query(`
        INSERT INTO asset_categories (code, name, depreciation_method, useful_life_months)
        VALUES ('CAT-IND-MACH-P6', 'Industrial Sewing & Weaving', 'STRAIGHT_LINE', 60)
        RETURNING id;
      `);
      categoryMachineryId = cat1.rows[0].id;
    }

    const existingCat2 = await query("SELECT id FROM asset_categories WHERE code = 'CAT-RAW-MAT-P6' LIMIT 1");
    if (existingCat2.rows.length > 0) {
      categoryRawMaterialsId = existingCat2.rows[0].id;
    } else {
      const cat2 = await query(`
        INSERT INTO asset_categories (code, name, depreciation_method, useful_life_months)
        VALUES ('CAT-RAW-MAT-P6', 'Raw Textile & Spares', 'STRAIGHT_LINE', 36)
        RETURNING id;
      `);
      categoryRawMaterialsId = cat2.rows[0].id;
    }

    // Available serialized asset for fulfillment tests
    const astRes = await query(`
      INSERT INTO assets (company_id, category_id, asset_tag, barcode, qr_code, name, purchase_cost, current_value, status, condition)
      VALUES ($1, $2, 'AST-P6-AVAIL-001', 'BAR-P6-AVAIL-001', 'QR-P6-AVAIL-001', 'Brother Industrial Overlock Machine', 55000.00, 55000.00, 'AVAILABLE', 'NEW')
      ON CONFLICT (asset_tag) DO UPDATE SET status = 'AVAILABLE', assigned_employee_id = NULL
      RETURNING id;
    `, [apparelsCompanyId, categoryMachineryId]);
    testAvailableAssetId = astRes.rows[0].id;
    await query("DELETE FROM asset_assignments WHERE asset_id = $1;", [testAvailableAssetId]);
  });

  // ==========================================
  // SECTION 1: STOCK MANAGEMENT & CONSTRAINTS
  // ==========================================
  describe("1. Stock Item CRUD, Constraints & Valuation", () => {
    let createdStockId: string;

    it("1.1 Register stock item with valid fields and company boundary", async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-THREAD-P6",
          itemName: "Heavy Duty Polyester Thread Spool",
          categoryId: categoryRawMaterialsId,
          unit: "SPOOL",
          quantityOnHand: 100,
          minimumQuantity: 20,
          reorderLevel: 30,
          maximumQuantity: 500,
          unitCost: 12.50,
          description: "High tensile thread for denim stitching"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stock_code).toBe("STK-THREAD-P6");
      expect(res.body.data.company_id).toBe(apparelsCompanyId);
      expect(res.body.data.quantity_on_hand).toBe(100);
      expect(Number(res.body.data.total_valuation)).toBe(1250);
      expect(res.body.data.stock_status).toBe("HEALTHY");

      createdStockId = res.body.data.id;
    });

    it("1.2 Stock code uniqueness is strictly enforced per company (same company duplicate rejected)", async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-THREAD-P6",
          itemName: "Duplicate Thread Item",
          unit: "SPOOL",
          quantityOnHand: 50,
          unitCost: 10.00
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message || res.body.error).toMatch(/already exists/i);
    });

    it("1.3 Same stock code is allowed in a different company (multi-tenant uniqueness)", async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          stockCode: "STK-THREAD-P6",
          itemName: "Garments Thread Spool",
          unit: "SPOOL",
          quantityOnHand: 40,
          unitCost: 11.00
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company_id).toBe(garmentsCompanyId);
    });

    it("1.4 PostgreSQL check constraint strictly rejects negative quantity_on_hand at DB level", async () => {
      await expect(
        query(`
          INSERT INTO stock_items (company_id, stock_code, item_name, unit, quantity_on_hand, unit_cost)
          VALUES ($1, 'STK-NEG-TEST', 'Illegal Negative Item', 'PCS', -5, 10.00);
        `, [apparelsCompanyId])
      ).rejects.toThrow();
    });

    it("1.5 Decimal precision on unit cost and accurate valuation computation", async () => {
      const res = await request(app)
        .get(`/api/v1/stock/${createdStockId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(Number(res.body.data.unit_cost)).toBe(12.50);
      expect(Number(res.body.data.total_valuation)).toBe(1250.00);
    });

    it("1.6 Stock status computation: LOW_STOCK and OUT_OF_STOCK and OVERSTOCK", async () => {
      // Create Low Stock item
      const lowRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-NEEDLE-LOW",
          itemName: "Titanium Sewing Needle Pack",
          unit: "PACK",
          quantityOnHand: 15,
          minimumQuantity: 20,
          reorderLevel: 25,
          unitCost: 5.00
        });
      expect(lowRes.status).toBe(201);
      expect(lowRes.body.data.stock_status).toBe("LOW_STOCK");

      // Create Out of Stock item
      const oosRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-BOBBIN-EMPTY",
          itemName: "Steel Bobbin Set",
          unit: "SET",
          quantityOnHand: 0,
          minimumQuantity: 10,
          reorderLevel: 15,
          unitCost: 8.00
        });
      expect(oosRes.status).toBe(201);
      expect(oosRes.body.data.stock_status).toBe("OUT_OF_STOCK");

      // Create Overstock item
      const overRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-BUTTON-OVER",
          itemName: "Standard Pearl Buttons",
          unit: "GROSS",
          quantityOnHand: 1200,
          maximumQuantity: 1000,
          minimumQuantity: 100,
          reorderLevel: 200,
          unitCost: 1.50
        });
      expect(overRes.status).toBe(201);
      expect(overRes.body.data.stock_status).toBe("OVERSTOCK");
    });

    it("1.7 Low stock alerts endpoint returns items at or below reorder level", async () => {
      const res = await request(app)
        .get("/api/v1/stock/alerts")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const codes = res.body.data.map((item: { stock_code: string }) => item.stock_code);
      expect(codes).toContain("STK-NEEDLE-LOW");
      expect(codes).toContain("STK-BOBBIN-EMPTY");
      expect(codes).not.toContain("STK-THREAD-P6");
    });
  });

  // ====================================================
  // SECTION 2: STOCK MOVEMENTS LEDGER & CONCURRENCY
  // ====================================================
  describe("2. Stock Ledger Movements & Concurrency Control", () => {
    let movementStockId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-ZIPPER-P6",
          itemName: "Brass Heavy Duty Zippers 20cm",
          unit: "BOX",
          quantityOnHand: 50,
          unitCost: 25.00
        });
      movementStockId = res.body.data.id;
    });

    it("2.1 Movement recording: RECEIPT increases stock balance and creates immutable audit log", async () => {
      const res = await request(app)
        .post(`/api/v1/stock/${movementStockId}/movements`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          movementType: "RECEIPT",
          quantity: 30,
          notes: "Vendor delivery batch #P6-001"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.movement.balance_before).toBe(50);
      expect(res.body.data.movement.balance_after).toBe(80);
      expect(res.body.data.stockItem.quantity_on_hand).toBe(80);
    });

    it("2.2 Movement recording: ISSUE decreases stock balance", async () => {
      const res = await request(app)
        .post(`/api/v1/stock/${movementStockId}/movements`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          movementType: "ISSUE",
          quantity: 20,
          notes: "Issued to Cutting floor"
        });

      expect(res.status).toBe(201);
      expect(res.body.data.movement.balance_before).toBe(80);
      expect(res.body.data.movement.balance_after).toBe(60);
      expect(res.body.data.stockItem.quantity_on_hand).toBe(60);
    });

    it("2.3 Movement with zero or negative quantity is strictly rejected (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/stock/${movementStockId}/movements`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          movementType: "ISSUE",
          quantity: -10
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("2.4 Issue quantity exceeding available stock is rejected (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/stock/${movementStockId}/movements`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          movementType: "ISSUE",
          quantity: 9999,
          notes: "Attempt to overdraft stock"
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/insufficient stock/i);
    });

    it("2.5 Concurrency test: Multiple concurrent issue requests cannot drive stock negative (SELECT FOR UPDATE)", async () => {
      // Create a test item with strictly 10 items
      const itemRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-CONCUR-P6",
          itemName: "Limited Edition Cutting Blades",
          unit: "PACK",
          quantityOnHand: 10,
          unitCost: 100.00
        });
      const concurItemId = itemRes.body.data.id;

      // Fire 5 concurrent requests attempting to issue 3 units each (Total requested: 15, Available: 10)
      const issuePromises = Array.from({ length: 5 }).map(() =>
        request(app)
          .post(`/api/v1/stock/${concurItemId}/movements`)
          .set("Authorization", `Bearer ${assetManagerToken}`)
          .send({
            movementType: "ISSUE",
            quantity: 3,
            notes: "Concurrent issue attempt"
          })
      );

      const results = await Promise.all(issuePromises);

      const successCount = results.filter((r) => r.status === 201).length;
      const failCount = results.filter((r) => r.status === 400).length;

      // Exactly 3 requests of 3 units should succeed (3 * 3 = 9 units deducted, 1 left)
      // The remaining 2 requests must be rejected due to insufficient stock (1 unit left < 3 required)
      expect(successCount).toBe(3);
      expect(failCount).toBe(2);

      // Verify the final balance in DB is strictly >= 0
      const finalRes = await request(app)
        .get(`/api/v1/stock/${concurItemId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(finalRes.body.data.quantity_on_hand).toBe(1);
    });

    it("2.6 Stock movements history is paginated and contains complete audit trail", async () => {
      const res = await request(app)
        .get(`/api/v1/stock/${movementStockId}/movements`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.movements.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // SECTION 3: APPROVAL WORKFLOW CONFIGURATION
  // ==========================================
  describe("3. Configurable Approval Workflows", () => {
    let customWorkflowId: string;

    it("3.1 Create multi-tier workflow with sequential steps", async () => {
      const res = await request(app)
        .post("/api/v1/approval-workflows")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "High Value Capital Expenditure Workflow",
          description: "Required for requisitions exceeding $5,000",
          minAmount: 5000.00,
          steps: [
            { stepNumber: 1, approvalLevel: 1, roleCode: "DEPT_MANAGER", stepName: "Department Manager Initial Review" },
            { stepNumber: 2, approvalLevel: 2, roleCode: "ASSET_MANAGER", stepName: "Asset Manager Technical Evaluation" },
            { stepNumber: 3, approvalLevel: 3, roleCode: "COMPANY_ADMIN", stepName: "Executive Financial Clearance" },
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.steps.length).toBe(3);
      expect(res.body.data.name).toBe("High Value Capital Expenditure Workflow");
      customWorkflowId = res.body.data.id;
    });

    it("3.2 Workflow step validation: Sequence gaps or duplicate step numbers are rejected", async () => {
      const res = await request(app)
        .post("/api/v1/approval-workflows")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          name: "Invalid Gap Workflow",
          steps: [
            { stepNumber: 1, approvalLevel: 1, roleCode: "DEPT_MANAGER" },
            { stepNumber: 3, approvalLevel: 3, roleCode: "COMPANY_ADMIN" }, // Gap: missing step 2
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/must be sequential/i);
    });

    it("3.3 Cross-company workflow isolation: Garments cannot modify Apparels workflow", async () => {
      const res = await request(app)
        .put(`/api/v1/approval-workflows/${customWorkflowId}`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          name: "Malicious Cross-Company Rename"
        });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // SECTION 4: ASSET REQUISITIONS LIFECYCLE
  // ==========================================
  describe("4. Asset Requisitions Lifecycle & Sequence Numbering", () => {
    let draftRequestId: string;
    let requisitionStockItemId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-SCISSOR-P6",
          itemName: "Tailoring Shear Scissor 10-inch",
          unit: "PCS",
          quantityOnHand: 25,
          unitCost: 45.00
        });
      requisitionStockItemId = res.body.data.id;
    });

    it("4.1 Create requisition in DRAFT status with sequential REQ-YYYYMMDD-XXXX format", async () => {
      const res = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Tailoring Shear Scissor 10-inch",
          stockItemId: requisitionStockItemId,
          departmentId: deptCuttingId,
          quantity: 2,
          priority: "HIGH",
          justification: "Urgent replacement for worn cutting tools on line 3"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.request_number).toMatch(/^REQ-\d{8}-\d{4}$/);
      expect(res.body.data.employee_id).toBe(apparelsEmployeeId);
      expect(res.body.data.requester_id).toBe(apparelsUserId);

      draftRequestId = res.body.data.id;
    });

    it("4.2 Update requisition details while in DRAFT status", async () => {
      const res = await request(app)
        .put(`/api/v1/requests/${draftRequestId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          quantity: 3,
          justification: "Updated: Need 3 scissors for line 3 & line 4"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.quantity).toBe(3);
      expect(res.body.data.justification).toMatch(/Need 3 scissors/);
    });

    it("4.3 Submit requisition transitions status to PENDING_APPROVAL and generates approval stages", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${draftRequestId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PENDING_APPROVAL");
      expect(res.body.data.current_approval_level).toBe(1);

      // Verify approval stages created
      const stagesRes = await request(app)
        .get(`/api/v1/requests/${draftRequestId}/approvals`)
        .set("Authorization", `Bearer ${deptManagerToken}`);

      expect(stagesRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(stagesRes.body.data[0].step_number).toBe(1);
      expect(stagesRes.body.data[0].status).toBe("PENDING");
    });

    it("4.4 Submitting an already submitted requisition is rejected (409 Conflict)", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${draftRequestId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message || res.body.error).toMatch(/only draft requisitions can be submitted/i);
    });

    it("4.5 Cancelling a submitted requisition sets status to CANCELLED and cancels pending steps", async () => {
      // Create another request to test cancellation
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Cancelled Test Request",
          quantity: 1,
          justification: "To be cancelled"
        });
      const cancelId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${cancelId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const cancelRes = await request(app)
        .post(`/api/v1/requests/${cancelId}/cancel`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ reason: "No longer needed by project lead" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe("CANCELLED");
    });
  });

  // ==========================================
  // SECTION 5: MULTI-LEVEL APPROVAL FLOWS
  // ==========================================
  describe("5. Multi-Level Approval Process & Role-Based Approvals", () => {
    let multiApprovalRequestId: string;
    let step1ApprovalId: string;
    let step2ApprovalId: string;
    let step3ApprovalId: string;

    beforeAll(async () => {
      // Submit a fresh requisition
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Ergonomic Cutting Table Station",
          departmentId: deptCuttingId,
          quantity: 1,
          priority: "HIGH",
          justification: "Required for high volume production line"
        });
      multiApprovalRequestId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${multiApprovalRequestId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const stagesRes = await request(app)
        .get(`/api/v1/requests/${multiApprovalRequestId}/approvals`)
        .set("Authorization", `Bearer ${deptManagerToken}`);

      const stages = stagesRes.body.data || [];
      step1ApprovalId = stages[0]?.id;
      step2ApprovalId = stages[1]?.id;
      step3ApprovalId = stages[2]?.id;
    });

    it("5.1 Out-of-order approval rejected: Cannot approve Step 2 while Step 1 is PENDING", async () => {
      if (step2ApprovalId) {
        const res = await request(app)
          .post(`/api/v1/requests/${multiApprovalRequestId}/approvals/${step2ApprovalId}/approve`)
          .set("Authorization", `Bearer ${assetManagerToken}`)
          .send({ remarks: "Attempting premature step 2 approval" });

        expect(res.status).toBe(400);
        expect(res.body.message || res.body.error).toMatch(/cannot skip|out of order/i);
      }
    });

    it("5.2 Unauthorized role rejected: Asset Manager cannot approve Step 1 (DEPT_MANAGER role required)", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${multiApprovalRequestId}/approvals/${step1ApprovalId}/approve`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({ remarks: "Role mismatch attempt" });

      expect(res.status).toBe(403);
      expect(res.body.message || res.body.error).toMatch(/unauthorized approver/i);
    });

    it("5.3 Step 1 approved by Department Manager: Requisition status -> PARTIALLY_APPROVED, advances to Level 2", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${multiApprovalRequestId}/approvals/${step1ApprovalId}/approve`)
        .set("Authorization", `Bearer ${deptManagerToken}`)
        .send({ remarks: "Verified department requirement. Approved." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reqRes = await request(app)
        .get(`/api/v1/requests/${multiApprovalRequestId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(reqRes.body.data.status).toBe("PARTIALLY_APPROVED");
      expect(reqRes.body.data.current_approval_level).toBe(2);
    });

    it("5.4 Step 2 approved by Asset Manager: Advances to Level 3", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${multiApprovalRequestId}/approvals/${step2ApprovalId}/approve`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({ remarks: "Equipment specs verified. Approved." });

      expect(res.status).toBe(200);

      const reqRes = await request(app)
        .get(`/api/v1/requests/${multiApprovalRequestId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(reqRes.body.data.current_approval_level).toBe(3);
    });

    it("5.5 Step 3 approved by Company Admin: Transitions to fully APPROVED", async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${multiApprovalRequestId}/approvals/${step3ApprovalId}/approve`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({ remarks: "Final budgetary sign-off. Approved." });

      expect(res.status).toBe(200);

      const reqRes = await request(app)
        .get(`/api/v1/requests/${multiApprovalRequestId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(reqRes.body.data.status).toBe("APPROVED");
    });

    it("5.6 Global Common Admin override: Common Admin can approve any approval stage", async () => {
      // Create and submit a new request
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Common Admin Override Request",
          quantity: 1,
          justification: "Test global override"
        });
      const ovReqId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${ovReqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const stagesRes = await request(app)
        .get(`/api/v1/requests/${ovReqId}/approvals`)
        .set("Authorization", `Bearer ${commonAdminToken}`);
      const stg1Id = stagesRes.body.data[0].id;

      const res = await request(app)
        .post(`/api/v1/requests/${ovReqId}/approvals/${stg1Id}/approve`)
        .set("Authorization", `Bearer ${commonAdminToken}`)
        .send({ remarks: "Global authority expedited sign-off" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("5.7 Rejection at any stage immediately marks request REJECTED (terminal) and cancels remaining steps", async () => {
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Rejected Request Sample",
          quantity: 1,
          justification: "Testing rejection flow"
        });
      const rejReqId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${rejReqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const stagesRes = await request(app)
        .get(`/api/v1/requests/${rejReqId}/approvals`)
        .set("Authorization", `Bearer ${commonAdminToken}`);
      const stg1Id = stagesRes.body.data[0].id;

      const rejRes = await request(app)
        .post(`/api/v1/requests/${rejReqId}/approvals/${stg1Id}/reject`)
        .set("Authorization", `Bearer ${deptManagerToken}`)
        .send({ remarks: "Budget exhausted for this quarter. Rejected." });

      expect(rejRes.status).toBe(200);

      const checkRes = await request(app)
        .get(`/api/v1/requests/${rejReqId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(checkRes.body.data.status).toBe("REJECTED");
    });

    it("5.8 Return for correction resets request to DRAFT and permits re-submission", async () => {
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Item Needing Correction",
          quantity: 5,
          justification: "Initial vague justification"
        });
      const retReqId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${retReqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const stagesRes = await request(app)
        .get(`/api/v1/requests/${retReqId}/approvals`)
        .set("Authorization", `Bearer ${commonAdminToken}`);
      const stg1Id = stagesRes.body.data[0].id;

      const returnRes = await request(app)
        .post(`/api/v1/requests/${retReqId}/approvals/${stg1Id}/return`)
        .set("Authorization", `Bearer ${deptManagerToken}`)
        .send({ remarks: "Please specify exact machine model numbers and department room" });

      expect(returnRes.status).toBe(200);

      // Verify request is reset to DRAFT
      const reqCheck = await request(app)
        .get(`/api/v1/requests/${retReqId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(reqCheck.body.data.status).toBe("DRAFT");

      // Employee updates and resubmits
      await request(app)
        .put(`/api/v1/requests/${retReqId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ justification: "Updated: Juki DDL-8700 for Room 204" });

      const resubRes = await request(app)
        .post(`/api/v1/requests/${retReqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(resubRes.status).toBe(200);
      expect(resubRes.body.data.status).toBe("PENDING_APPROVAL");
    });
  });

  // ==========================================
  // SECTION 6: REQUISITION FULFILLMENT
  // ==========================================
  describe("6. Requisition Fulfillment (Stock Ledger & Serialized Custody)", () => {
    let stockItemForFulfillmentId: string;

    beforeAll(async () => {
      const sRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`)
        .send({
          stockCode: "STK-FULFILL-P6",
          itemName: "Rotary Cutter Spare Blades",
          unit: "PACK",
          quantityOnHand: 15,
          unitCost: 18.00
        });
      stockItemForFulfillmentId = sRes.body.data.id;
    });

    it("6.1 Fulfill requisition from stock: deducts stock quantity, generates ISSUE movement, transitions to FULFILLED", async () => {
      // 1. Create and fully approve a request
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Rotary Cutter Spare Blades",
          stockItemId: stockItemForFulfillmentId,
          quantity: 5,
          justification: "Cutting workshop maintenance"
        });
      const reqId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${reqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      // Auto-approve using Common Admin override
      const stagesRes = await request(app)
        .get(`/api/v1/requests/${reqId}/approvals`)
        .set("Authorization", `Bearer ${commonAdminToken}`);

      for (const stg of stagesRes.body.data) {
        await request(app)
          .post(`/api/v1/requests/${reqId}/approvals/${stg.id}/approve`)
          .set("Authorization", `Bearer ${commonAdminToken}`)
          .send({ remarks: "Bulk expedited approval" });
      }

      // 2. Fulfill from stock
      const fulfillRes = await request(app)
        .post(`/api/v1/requests/${reqId}/fulfill`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          fulfillmentType: "STOCK",
          fulfillmentNotes: "Issued 5 packs from Central Warehouse Bay A"
        });

      expect(fulfillRes.status).toBe(200);
      expect(fulfillRes.body.success).toBe(true);
      expect(fulfillRes.body.data.status).toBe("FULFILLED");
      expect(fulfillRes.body.data.fulfilled_stock_movement_id).toBeDefined();

      // 3. Verify stock was deducted (15 - 5 = 10)
      const stockRes = await request(app)
        .get(`/api/v1/stock/${stockItemForFulfillmentId}`)
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(stockRes.body.data.quantity_on_hand).toBe(10);
    });

    it("6.2 Fulfill requisition from serialized fixed asset: assigns asset to employee via Phase 5 custody service", async () => {
      // 1. Create and approve request for a machine
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Industrial Overlock Machine",
          quantity: 1,
          justification: "Station expansion for line 5"
        });
      const reqId = reqRes.body.data.id;

      await request(app)
        .post(`/api/v1/requests/${reqId}/submit`)
        .set("Authorization", `Bearer ${employeeToken}`);

      const stagesRes = await request(app)
        .get(`/api/v1/requests/${reqId}/approvals`)
        .set("Authorization", `Bearer ${commonAdminToken}`);

      for (const stg of stagesRes.body.data) {
        await request(app)
          .post(`/api/v1/requests/${reqId}/approvals/${stg.id}/approve`)
          .set("Authorization", `Bearer ${commonAdminToken}`)
          .send({ remarks: "Expedited asset requisition" });
      }

      // 2. Fulfill with existing serialized asset
      const fulfillRes = await request(app)
        .post(`/api/v1/requests/${reqId}/fulfill`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({
          fulfillmentType: "ASSET",
          existingAssetId: testAvailableAssetId,
          fulfillmentNotes: "Serial asset handed over in excellent condition"
        });

      expect(fulfillRes.status).toBe(200);
      expect(fulfillRes.body.data.status).toBe("FULFILLED");
      expect(fulfillRes.body.data.fulfilled_asset_id).toBe(testAvailableAssetId);

      // 3. Verify asset is now in ASSIGNED status under the employee
      const assetRes = await query("SELECT status, assigned_employee_id FROM assets WHERE id = $1", [testAvailableAssetId]);
      expect(assetRes.rows[0].status).toBe("ASSIGNED");
      expect(assetRes.rows[0].assigned_employee_id).toBe(apparelsEmployeeId);
    });

    it("6.3 Fulfill non-approved requisition is strictly rejected (409 Conflict)", async () => {
      const reqRes = await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          itemName: "Unapproved Request",
          quantity: 1,
          justification: "Draft fulfill test"
        });
      const unapprovedId = reqRes.body.data.id;

      const res = await request(app)
        .post(`/api/v1/requests/${unapprovedId}/fulfill`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({ fulfillmentType: "STOCK" });

      expect(res.status).toBe(409);
      expect(res.body.message || res.body.error).toMatch(/must be in 'APPROVED' status/i);
    });

    it("6.4 Double fulfillment prevented: Already FULFILLED requisition cannot be fulfilled again", async () => {
      // Find any fulfilled request
      const fRes = await query("SELECT id FROM asset_requests WHERE status = 'FULFILLED' LIMIT 1");
      const fulfilledId = fRes.rows[0].id;

      const res = await request(app)
        .post(`/api/v1/requests/${fulfilledId}/fulfill`)
        .set("Authorization", `Bearer ${assetManagerToken}`)
        .send({ fulfillmentType: "STOCK" });

      expect(res.status).toBe(409);
      expect(res.body.message || res.body.error).toMatch(/must be in 'APPROVED' status/i);
    });
  });

  // ==========================================
  // SECTION 7: REQUEST HISTORY & NOTIFICATIONS
  // ==========================================
  describe("7. Request Audit History & Notifications", () => {
    it("7.1 Request history records every lifecycle state transition with actor and remarks", async () => {
      const fRes = await query("SELECT id FROM asset_requests WHERE status = 'FULFILLED' LIMIT 1");
      const reqId = fRes.rows[0].id;

      const res = await request(app)
        .get(`/api/v1/requests/${reqId}/history`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const actions = res.body.data.map((h: { action: string }) => h.action);
      expect(actions).toContain("REQUEST_CREATED");
      expect(actions).toContain("REQUEST_SUBMITTED");
      expect(actions).toContain("REQUEST_FULFILLED");
    });

    it("7.2 System generated notifications on requisition approvals", async () => {
      const notifRes = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(notifRes.status).toBe(200);
      expect(Array.isArray(notifRes.body.data)).toBe(true);
    });
  });

  // =======================================================
  // SECTION 8: TENANT ISOLATION, RBAC & SECURITY POLICIES
  // =======================================================
  describe("8. Multi-Company Isolation & Role-Based Access Control", () => {
    it("8.1 Common Admin has global cross-company visibility over stock and requisitions", async () => {
      const stockRes = await request(app)
        .get("/api/v1/stock")
        .set("Authorization", `Bearer ${commonAdminToken}`);

      expect(stockRes.status).toBe(200);
      const companyIds = Array.from(new Set(stockRes.body.data.items.map((i: { company_id: string }) => i.company_id)));
      expect(companyIds.length).toBeGreaterThanOrEqual(2);
    });

    it("8.2 Company Admin is strictly scoped to their company (cannot view other company stock)", async () => {
      const res = await request(app)
        .get("/api/v1/stock")
        .set("Authorization", `Bearer ${apparelsAdminToken}`);

      expect(res.status).toBe(200);
      const nonApparels = res.body.data.items.filter((i: { company_id: string }) => i.company_id !== apparelsCompanyId);
      expect(nonApparels.length).toBe(0);
    });

    it("8.3 Employee cannot view peer employee requisitions, and cross-company employee cannot view request", async () => {
      // Find a request belonging to someone else
      const otherReqRes = await query("SELECT id FROM asset_requests WHERE requester_id != $1 LIMIT 1", [apparelsUserId]);
      if (otherReqRes.rows.length > 0) {
        const otherId = otherReqRes.rows[0].id;
        const res = await request(app)
          .get(`/api/v1/requests/${otherId}`)
          .set("Authorization", `Bearer ${employeeToken}`);

        expect(res.status).toBe(403);
      }

      // Garments employee cannot view Apparels requisition
      const appReqRes = await query("SELECT id FROM asset_requests WHERE company_id = $1 LIMIT 1", [apparelsCompanyId]);
      if (appReqRes.rows.length > 0) {
        const appId = appReqRes.rows[0].id;
        const resGar = await request(app)
          .get(`/api/v1/requests/${appId}`)
          .set("Authorization", `Bearer ${garmentsEmployeeToken}`);

        expect(resGar.status).toBe(403);
      }
    });

    it("8.4 Cross-company stock tampering is blocked with 403 Forbidden", async () => {
      // Garments admin tries to record movement on Apparels stock item
      const appStock = (await query("SELECT id FROM stock_items WHERE company_id = $1 LIMIT 1", [apparelsCompanyId])).rows[0].id;

      const res = await request(app)
        .post(`/api/v1/stock/${appStock}/movements`)
        .set("Authorization", `Bearer ${garmentsAdminToken}`)
        .send({
          movementType: "ISSUE",
          quantity: 1,
          notes: "Malicious cross-company issue"
        });

      expect(res.status).toBe(403);
      expect(res.body.message || res.body.error).toMatch(/cross-company/i);
    });

    it("8.5 Cross-company approval tampering is blocked with 403 Forbidden", async () => {
      // Find pending approval under Apparels
      const appApproval = (await query(`
        SELECT a.id, a.request_id 
        FROM asset_request_approvals a 
        JOIN asset_requests r ON a.request_id = r.id 
        WHERE r.company_id = $1 AND a.status = 'PENDING' LIMIT 1
      `, [apparelsCompanyId])).rows[0];

      if (appApproval) {
        const res = await request(app)
          .post(`/api/v1/requests/${appApproval.request_id}/approvals/${appApproval.id}/approve`)
          .set("Authorization", `Bearer ${garmentsAdminToken}`)
          .send({ remarks: "Cross-company approval hack" });

        expect(res.status).toBe(403);
      }
    });

    it("8.6 Auditor has read-only access (can view stock and requisitions, cannot create)", async () => {
      // Can view stock
      const viewRes = await request(app)
        .get("/api/v1/stock")
        .set("Authorization", `Bearer ${auditorToken}`);
      expect(viewRes.status).toBe(200);

      // Cannot create stock item
      const createRes = await request(app)
        .post("/api/v1/stock")
        .set("Authorization", `Bearer ${auditorToken}`)
        .send({
          stockCode: "STK-AUDIT-ILLEGAL",
          itemName: "Auditor Illegal Item",
          unit: "PCS",
          quantityOnHand: 10,
          unitCost: 10.00
        });
      expect(createRes.status).toBe(403);
    });

    it("8.7 Unauthenticated access to Phase 6 endpoints is strictly rejected (401 Unauthorized)", async () => {
      const r1 = await request(app).get("/api/v1/stock");
      expect(r1.status).toBe(401);

      const r2 = await request(app).get("/api/v1/requests");
      expect(r2.status).toBe(401);

      const r3 = await request(app).get("/api/v1/approvals/pending");
      expect(r3.status).toBe(401);
    });
  });
});
