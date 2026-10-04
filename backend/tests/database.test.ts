import { pool, query, testConnection } from "../src/config/database";

describe("Phase 1: Database Connection & Schema Verification", () => {
  afterAll(async () => {
    await pool.end();
  });

  // Test 1: Database connection
  test("1. PostgreSQL database connection should be healthy and responsive", async () => {
    const isConnected = await testConnection();
    expect(isConnected).toBe(true);
  });

  // Test 2: Migration success (verify all 29 required tables exist)
  test("2. All 29 required relational schema tables must exist", async () => {
    const expectedTables = [
      "companies",
      "branches",
      "departments",
      "locations",
      "roles",
      "permissions",
      "role_permissions",
      "employees",
      "users",
      "user_permissions",
      "vendors",
      "asset_categories",
      "assets",
      "asset_documents",
      "asset_photos",
      "stock_items",
      "stock_movements",
      "asset_requests",
      "asset_request_approvals",
      "asset_assignments",
      "asset_returns",
      "maintenance_records",
      "asset_transfers",
      "inter_company_transfers",
      "handover_records",
      "asset_history",
      "notifications",
      "audit_logs",
      "system_settings"
    ];

    const res = await query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = new Set(res.rows.map((r) => r.table_name));

    for (const table of expectedTables) {
      expect(existingTables.has(table)).toBe(true);
    }
  });

  // Test 3: Seed success
  test("3. Master permissions and system roles should be seeded", async () => {
    const permCountRes = await query("SELECT COUNT(*) as count FROM permissions");
    expect(parseInt(permCountRes.rows[0].count, 10)).toBeGreaterThanOrEqual(40);

    const rolesRes = await query("SELECT code FROM roles WHERE code = 'COMMON_ADMIN'");
    expect(rolesRes.rows.length).toBe(1);
  });

  // Test 5: Pantone Apparels exists
  test("5. Pantone Apparels company entity must exist with code 'PANTONE-APP'", async () => {
    const res = await query("SELECT * FROM companies WHERE code = 'PANTONE-APP'");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].name).toBe("Pantone Apparels");
    expect(res.rows[0].is_active).toBe(true);
  });

  // Test 6: Pantone Garments exists
  test("6. Pantone Garments company entity must exist with code 'PANTONE-GAR'", async () => {
    const res = await query("SELECT * FROM companies WHERE code = 'PANTONE-GAR'");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].name).toBe("Pantone Garments");
    expect(res.rows[0].is_active).toBe(true);
  });

  // Test 7: User belongs to exactly the intended company
  test("7. Users must belong strictly to their intended tenancy boundary", async () => {
    const commonAdminRes = await query(`
      SELECT u.username, u.company_id, r.code as role_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = 'common_admin'
    `);
    expect(commonAdminRes.rows.length).toBe(1);
    // Common Admin must have global NULL tenancy
    expect(commonAdminRes.rows[0].company_id).toBeNull();
    expect(commonAdminRes.rows[0].role_code).toBe("COMMON_ADMIN");

    const apparelsAdminRes = await query(`
      SELECT u.username, c.code as company_code
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.username = 'apparels_admin'
    `);
    expect(apparelsAdminRes.rows.length).toBe(1);
    expect(apparelsAdminRes.rows[0].company_code).toBe("PANTONE-APP");

    const garmentsAdminRes = await query(`
      SELECT u.username, c.code as company_code
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.username = 'garments_admin'
    `);
    expect(garmentsAdminRes.rows.length).toBe(1);
    expect(garmentsAdminRes.rows[0].company_code).toBe("PANTONE-GAR");
  });
});