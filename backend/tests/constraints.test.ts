import { pool, query } from "../src/config/database";
import { v4 as uuidv4 } from "uuid";

describe("Phase 1: Constraints & Data Integrity Verification", () => {
  let createdCompanyId: string;

  afterAll(async () => {
    if (createdCompanyId) {
      await query("DELETE FROM companies WHERE id = $1", [createdCompanyId]);
    }
    await pool.end();
  });

  // Test 4: Company creation
  test("4. System must allow creating a new company with valid data", async () => {
    const testCode = `TEST-CO-${Date.now()}`;
    const res = await query(`
      INSERT INTO companies (code, name, address, email, is_active)
      VALUES ($1, 'Test Company Ltd', 'Industrial Sector 1', 'test@company.com', true)
      RETURNING id, code, name
    `, [testCode]);

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].code).toBe(testCode);
    createdCompanyId = res.rows[0].id;
  });

  // Test 8: Foreign key constraints
  test("8. PostgreSQL must strictly reject records referencing non-existent foreign keys", async () => {
    const nonExistentId = uuidv4();

    // Attempt to insert branch with non-existent company_id
    let error: { code?: string } | null = null;
    try {
      await query(`
        INSERT INTO branches (company_id, code, name)
        VALUES ($1, 'BR-FAIL', 'Failing Branch')
      `, [nonExistentId]);
    } catch (err: unknown) {
      error = err as { code?: string };
    }

    expect(error).not.toBeNull();
    // PostgreSQL error code 23503: foreign_key_violation
    expect(error?.code).toBe("23503");
  });

  // Test 9: Unique constraints
  test("9. System must enforce uniqueness across company codes and usernames", async () => {
    // Attempt duplicate company code
    let dupCompanyErr: { code?: string } | null = null;
    try {
      await query(`
        INSERT INTO companies (code, name)
        VALUES ('PANTONE-APP', 'Duplicate Pantone Apparels')
      `);
    } catch (err: unknown) {
      dupCompanyErr = err as { code?: string };
    }

    expect(dupCompanyErr).not.toBeNull();
    expect(dupCompanyErr?.code).toBe("23505"); // unique_violation

    // Attempt duplicate username
    let dupUserErr: { code?: string } | null = null;
    try {
      await query(`
        INSERT INTO users (username, email, password_hash, role_id)
        VALUES ('common_admin', 'different_email@test.com', 'hash123', (SELECT id FROM roles WHERE code = 'COMMON_ADMIN' LIMIT 1))
      `);
    } catch (err: unknown) {
      dupUserErr = err as { code?: string };
    }

    expect(dupUserErr).not.toBeNull();
    expect(dupUserErr?.code).toBe("23505"); // unique_violation
  });
});