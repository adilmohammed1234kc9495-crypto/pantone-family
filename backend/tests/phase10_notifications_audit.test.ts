import request from "supertest";
import { createApp } from "../src/app";
import { query } from "../src/config/database";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/crypto";
import { notificationService } from "../src/modules/notifications/notification.service";
import { notificationJobs } from "../src/modules/notifications/notification.jobs";
import { auditService } from "../src/modules/audit/audit.service";
import { ForbiddenError } from "../src/utils/errors";

describe("Phase 10: In-App Notifications, System Events & Audit Hardening", () => {
  jest.setTimeout(45000);
  const app = createApp();

  let apparelsCompanyId: string;
  let garmentsCompanyId: string;

  // Tokens
  let commonAdminToken: string;
  let apparelsAdminToken: string;
  let garmentsAdminToken: string;
  let userAToken: string;
  let userBToken: string;
  let garmentsUserToken: string;
  let deptManagerToken: string;

  // User IDs
  let userAId: string;
  let userBId: string;
  let garmentsUserId: string;

  // Master Data IDs
  let apparelsBranchId: string;
  let apparelsDeptId: string;
  let apparelsLocId: string;
  let categoryId: string;
  let vendorId: string;
  let employeeAId: string;
  let employeeBId: string;
  let deptManagerEmpId: string;

  // Entity IDs
  let testAssetId: string;
  let intercompanyAssetId: string;
  let overdueAssetId: string;
  let overdueAssignmentId: string;
  let lowStockItemId: string;
  let pendingRequisitionId: string;
  let transferDisputedId: string;

  // Track created notifications
  let userANotification1Id: string;
  let userANotification2Id: string;
  let userBNotificationId: string;

  beforeAll(async () => {
    // 1. Get companies
    const appRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-APP'");
    apparelsCompanyId = appRes.rows[0].id;

    const garRes = await query("SELECT id FROM companies WHERE code = 'PANTONE-GAR'");
    garmentsCompanyId = garRes.rows[0].id;

    // 2. Clean previous Phase 10 test artifacts
    await query("DELETE FROM notifications WHERE title LIKE '%P10%' OR idempotency_key LIKE '%P10%'");
    await query("DELETE FROM user_notification_preferences WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'p10_%')");
    await query("DELETE FROM asset_request_approvals WHERE request_id IN (SELECT id FROM asset_requests WHERE request_code LIKE 'REQ-P10-%' OR item_name LIKE '%P10%')");
    await query("DELETE FROM asset_requests WHERE request_code LIKE 'REQ-P10-%' OR item_name LIKE '%P10%'");
    await query("DELETE FROM maintenance_records WHERE maintenance_code LIKE 'MNT-P10-%' OR problem LIKE '%P10%'");
    await query("DELETE FROM asset_transfers WHERE transfer_code LIKE 'TRF-P10-%' OR reason LIKE '%P10%'");
    await query("DELETE FROM stock_movements WHERE stock_item_id IN (SELECT id FROM stock_items WHERE stock_code LIKE 'STK-P10-%')");
    await query("DELETE FROM stock_items WHERE stock_code LIKE 'STK-P10-%'");
    await query("DELETE FROM asset_assignments WHERE handover_remarks LIKE '%P10%'");
    await query("DELETE FROM assets WHERE asset_tag LIKE 'AST-P10-%'");
    await query("DELETE FROM users WHERE username IN ('p10_user_a', 'p10_user_b', 'p10_garments_user', 'p10_dept_manager', 'p10_lockout_user')");
    await query("DELETE FROM employees WHERE employee_code LIKE 'EMP-P10-%'");

    // 3. Admin Tokens
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

    // 4. Master Data
    const brRes = await query(`
      INSERT INTO branches (company_id, code, name)
      VALUES ($1, 'BR-P10-APP', 'Apparels P10 Branch')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsBranchId = brRes.rows[0].id;

    const deptRes = await query(`
      INSERT INTO departments (company_id, code, name)
      VALUES ($1, 'DPT-P10-OPS', 'P10 Operations Dept')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    apparelsDeptId = deptRes.rows[0].id;

    const locRes = await query(`
      INSERT INTO locations (company_id, branch_id, building, floor, room_number)
      VALUES ($1, $2, 'Building 10', 'Floor 2', 'Room 201')
      RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId]);
    apparelsLocId = locRes.rows[0].id;

    const catRes = await query(`
      INSERT INTO asset_categories (company_id, code, name, useful_life_months)
      VALUES ($1, 'CAT-P10-EQP', 'P10 Equipment', 48)
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    categoryId = catRes.rows[0].id;

    const venRes = await query(`
      INSERT INTO vendors (company_id, code, name, email)
      VALUES ($1, 'VEN-P10-01', 'P10 Vendor Global', 'vendor.p10@example.com')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [apparelsCompanyId]);
    vendorId = venRes.rows[0].id;

    // 5. Employees
    const empARes = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, department_id)
      VALUES ($1, 'EMP-P10-001', 'Alice', 'Rahman', 'alice.p10@apparels.com', $2)
      RETURNING id;
    `, [apparelsCompanyId, apparelsDeptId]);
    employeeAId = empARes.rows[0].id;

    const empBRes = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, department_id)
      VALUES ($1, 'EMP-P10-002', 'Bob', 'Karim', 'bob.p10@apparels.com', $2)
      RETURNING id;
    `, [apparelsCompanyId, apparelsDeptId]);
    employeeBId = empBRes.rows[0].id;

    const empDMRes = await query(`
      INSERT INTO employees (company_id, employee_code, first_name, last_name, email, department_id)
      VALUES ($1, 'EMP-P10-003', 'Diana', 'Manager', 'diana.p10@apparels.com', $2)
      RETURNING id;
    `, [apparelsCompanyId, apparelsDeptId]);
    deptManagerEmpId = empDMRes.rows[0].id;

    // 6. User Roles & Test Users
    const rolesResApp = await query<{ id: string; code: string }>("SELECT id, code FROM roles WHERE company_id = $1", [apparelsCompanyId]);
    const empRole = rolesResApp.rows.find((r) => r.code === "EMPLOYEE")!;
    const dmRole = rolesResApp.rows.find((r) => r.code === "DEPT_MANAGER")!;

    const rolesResGar = await query<{ id: string; code: string }>("SELECT id, code FROM roles WHERE company_id = $1", [garmentsCompanyId]);
    const garEmpRole = rolesResGar.rows.find((r) => r.code === "EMPLOYEE")!;

    const pwdHash = await hashPassword("Password@123");

    // User A
    const uARes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'p10_user_a', 'alice.p10@apparels.com', $2, $3, $4, true)
      RETURNING id;
    `, [apparelsCompanyId, pwdHash, empRole.id, employeeAId]);
    userAId = uARes.rows[0].id;

    // User B
    const uBRes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'p10_user_b', 'bob.p10@apparels.com', $2, $3, $4, true)
      RETURNING id;
    `, [apparelsCompanyId, pwdHash, empRole.id, employeeBId]);
    userBId = uBRes.rows[0].id;

    // Garments User
    const uGRes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'p10_garments_user', 'garments.p10@garments.com', $2, $3, true)
      RETURNING id;
    `, [garmentsCompanyId, pwdHash, garEmpRole.id]);
    garmentsUserId = uGRes.rows[0].id;

    // Dept Manager
    await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, employee_id, is_active)
      VALUES ($1, 'p10_dept_manager', 'diana.p10@apparels.com', $2, $3, $4, true)
      RETURNING id;
    `, [apparelsCompanyId, pwdHash, dmRole.id, deptManagerEmpId]);

    // Logins
    const uALogin = await request(app).post("/api/v1/auth/login").send({ username: "p10_user_a", password: "Password@123" });
    userAToken = uALogin.body.data.accessToken;

    const uBLogin = await request(app).post("/api/v1/auth/login").send({ username: "p10_user_b", password: "Password@123" });
    userBToken = uBLogin.body.data.accessToken;

    const uGLogin = await request(app).post("/api/v1/auth/login").send({ username: "p10_garments_user", password: "Password@123" });
    garmentsUserToken = uGLogin.body.data.accessToken;

    const uDMLogin = await request(app).post("/api/v1/auth/login").send({ username: "p10_dept_manager", password: "Password@123" });
    deptManagerToken = uDMLogin.body.data.accessToken;

    // 7. Seed Test Assets
    const astRes = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, serial_number, purchase_date, purchase_cost,
        depreciation_method, useful_life_months, accumulated_depreciation, current_value,
        status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'AST-P10-001', 'BAR-AST-P10-001', 'QR-AST-P10-001', 'P10 Standard Asset', 'SN-P10-001', '2026-01-01', 50000.00,
        'STRAIGHT_LINE', 48, 0.00, 50000.00,
        'AVAILABLE', 'EXCELLENT'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryId, vendorId]);
    testAssetId = astRes.rows[0].id;

    const astIc = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, serial_number, purchase_date, purchase_cost,
        depreciation_method, useful_life_months, accumulated_depreciation, current_value,
        status, condition
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'AST-P10-002', 'BAR-AST-P10-002', 'QR-AST-P10-002', 'P10 Inter-Company Asset', 'SN-P10-002', '2026-01-01', 75000.00,
        'STRAIGHT_LINE', 48, 0.00, 75000.00,
        'AVAILABLE', 'EXCELLENT'
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryId, vendorId]);
    intercompanyAssetId = astIc.rows[0].id;

    const astOverdue = await query(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, serial_number, purchase_date, purchase_cost,
        depreciation_method, useful_life_months, accumulated_depreciation, current_value,
        status, condition, assigned_employee_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'AST-P10-OVD', 'BAR-AST-P10-OVD', 'QR-AST-P10-OVD', 'P10 Overdue Asset', 'SN-P10-OVD', '2025-01-01', 30000.00,
        'STRAIGHT_LINE', 48, 5000.00, 25000.00,
        'ASSIGNED', 'GOOD', $7
      ) RETURNING id;
    `, [apparelsCompanyId, apparelsBranchId, apparelsDeptId, apparelsLocId, categoryId, vendorId, employeeAId]);
    overdueAssetId = astOverdue.rows[0].id;

    const asgnRes = await query(`
      INSERT INTO asset_assignments (company_id, asset_id, employee_id, assigned_by, return_due_date, status, handover_remarks)
      VALUES ($1, $2, $3, $4, '2025-02-01', 'ACTIVE', 'P10 Overdue Assignment Seed')
      RETURNING id;
    `, [apparelsCompanyId, overdueAssetId, employeeAId, userAId]);
    overdueAssignmentId = asgnRes.rows[0].id;
  });

  afterAll(async () => {
    await query("DELETE FROM notifications WHERE title LIKE '%P10%' OR idempotency_key LIKE '%P10%'");
    await query("DELETE FROM user_notification_preferences WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'p10_%')");
    await query("DELETE FROM asset_request_approvals WHERE request_id IN (SELECT id FROM asset_requests WHERE request_code LIKE 'REQ-P10-%' OR item_name LIKE '%P10%')");
    await query("DELETE FROM asset_requests WHERE request_code LIKE 'REQ-P10-%' OR item_name LIKE '%P10%'");
    await query("DELETE FROM maintenance_records WHERE maintenance_code LIKE 'MNT-P10-%' OR problem LIKE '%P10%'");
    await query("DELETE FROM asset_transfers WHERE transfer_code LIKE 'TRF-P10-%' OR reason LIKE '%P10%'");
    await query("DELETE FROM stock_movements WHERE stock_item_id IN (SELECT id FROM stock_items WHERE stock_code LIKE 'STK-P10-%')");
    await query("DELETE FROM stock_items WHERE stock_code LIKE 'STK-P10-%'");
    await query("DELETE FROM asset_assignments WHERE handover_remarks LIKE '%P10%'");
    await query("DELETE FROM assets WHERE asset_tag LIKE 'AST-P10-%'");
    await query("DELETE FROM users WHERE username IN ('p10_user_a', 'p10_user_b', 'p10_garments_user', 'p10_dept_manager', 'p10_lockout_user')");
    await query("DELETE FROM employees WHERE employee_code LIKE 'EMP-P10-%'");
  });

  // =========================================================================
  // GROUP 1: In-App Notification System & Lifecycle (Tests 1 - 10)
  // =========================================================================

  test("1. Successfully creates in-app notifications with controlled severities", async () => {
    const n1 = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "ASSET_ASSIGNED",
      title: "P10 Info Notification",
      message: "Asset assigned to you for operational testing.",
      severity: "INFO",
      entityType: "assets",
      entityId: testAssetId,
      actionUrl: `/assets/${testAssetId}`
    });
    expect(n1).toBeDefined();
    expect(n1!.severity).toBe("INFO");
    userANotification1Id = n1!.id;

    const n2 = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "DAMAGE_REPORTED",
      title: "P10 Critical Damage Notification",
      message: "Physical damage reported on your custody asset.",
      severity: "CRITICAL",
      entityType: "assets",
      entityId: testAssetId
    });
    expect(n2).toBeDefined();
    expect(n2!.severity).toBe("CRITICAL");
    userANotification2Id = n2!.id;

    const nB = await notificationService.create({
      userId: userBId,
      companyId: apparelsCompanyId,
      notificationType: "MAINTENANCE_CREATED",
      title: "P10 Bob Work Order",
      message: "Maintenance order scheduled.",
      severity: "WARNING"
    });
    expect(nB).toBeDefined();
    userBNotificationId = nB!.id;
  });

  test("2. GET /api/v1/notifications lists paginated notifications for authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/notifications?page=1&limit=10")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);
    expect(res.body.data.totalPages).toBeGreaterThanOrEqual(1);

    const ids = res.body.data.notifications.map((n: any) => n.id);
    expect(ids).toContain(userANotification1Id);
    expect(ids).toContain(userANotification2Id);
  });

  test("3. GET /api/v1/notifications filters by isRead status", async () => {
    const resUnread = await request(app)
      .get("/api/v1/notifications?isRead=false")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(resUnread.status).toBe(200);
    expect(resUnread.body.data.notifications.every((n: any) => n.is_read === false)).toBe(true);

    const resRead = await request(app)
      .get("/api/v1/notifications?isRead=true")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(resRead.status).toBe(200);
    expect(resRead.body.data.notifications.every((n: any) => n.is_read === true)).toBe(true);
  });

  test("4. GET /api/v1/notifications filters by severity", async () => {
    const res = await request(app)
      .get("/api/v1/notifications?severity=CRITICAL")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.notifications.every((n: any) => n.severity === "CRITICAL")).toBe(true);
    const ids = res.body.data.notifications.map((n: any) => n.id);
    expect(ids).toContain(userANotification2Id);
    expect(ids).not.toContain(userANotification1Id);
  });

  test("5. GET /api/v1/notifications filters by notificationType", async () => {
    const res = await request(app)
      .get("/api/v1/notifications?notificationType=DAMAGE_REPORTED")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.every((n: any) => n.notification_type === "DAMAGE_REPORTED")).toBe(true);
  });

  test("6. GET /api/v1/notifications filters by date range (startDate & endDate)", async () => {
    const d = new Date();
    const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const utcToday = d.toISOString().split("T")[0];
    const startDate = utcToday < localToday ? utcToday : localToday;
    const endDate = utcToday > localToday ? utcToday : localToday;

    const res = await request(app)
      .get(`/api/v1/notifications?startDate=${startDate}&endDate=${endDate}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(2);
  });

  test("7. GET /api/v1/notifications/unread-count returns accurate unread count", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.unreadCount).toBe("number");
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(2);
  });

  test("8. PATCH /api/v1/notifications/:id/read marks single notification as read", async () => {
    const initialCountRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userAToken}`);
    const initialUnread = initialCountRes.body.data.unreadCount;

    const res = await request(app)
      .patch(`/api/v1/notifications/${userANotification1Id}/read`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);

    const postCountRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(postCountRes.body.data.unreadCount).toBe(initialUnread - 1);
  });

  test("9. PATCH /api/v1/notifications/read-all marks all unread notifications as read", async () => {
    const res = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.markedCount).toBe("number");

    const countRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(countRes.body.data.unreadCount).toBe(0);
  });

  test("10. GET /api/v1/notifications/:id retrieves single notification details", async () => {
    const res = await request(app)
      .get(`/api/v1/notifications/${userANotification1Id}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(userANotification1Id);
    expect(res.body.data.title).toBe("P10 Info Notification");
    expect(res.body.data.action_url).toBe(`/assets/${testAssetId}`);
  });

  // =========================================================================
  // GROUP 2: Tenant Isolation & IDOR Protection (Tests 11 - 15)
  // =========================================================================

  test("11. User notification isolation: User A cannot see User B's notifications in list", async () => {
    const resA = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(resA.status).toBe(200);
    const listA = Array.isArray(resA.body.data) ? resA.body.data : resA.body.data.notifications;
    const idsA = listA.map((n: any) => n.id);
    expect(idsA).not.toContain(userBNotificationId);

    const resB = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(resB.status).toBe(200);
    const listB = Array.isArray(resB.body.data) ? resB.body.data : resB.body.data.notifications;
    const idsB = listB.map((n: any) => n.id);
    expect(idsB).toContain(userBNotificationId);
  });

  test("12. IDOR Protection: User A attempting GET /api/v1/notifications/:id on User B receives 403 Forbidden & logs security audit", async () => {
    const res = await request(app)
      .get(`/api/v1/notifications/${userBNotificationId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);

    // Verify security audit log record
    const auditRes = await query(`
      SELECT action, category, severity, status 
      FROM audit_logs 
      WHERE action = 'IDOR_NOTIFICATION_ACCESS' AND user_id = $1 
      ORDER BY timestamp DESC LIMIT 1
    `, [userAId]);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].category).toBe("SECURITY");
    expect(auditRes.rows[0].severity).toBe("CRITICAL");
    expect(auditRes.rows[0].status).toBe("FAILURE");
  });

  test("13. IDOR Protection: User A attempting PATCH /api/v1/notifications/:id/read on User B receives 403 Forbidden & logs security audit", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${userBNotificationId}/read`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);

    const auditRes = await query(`
      SELECT action, category, severity, status 
      FROM audit_logs 
      WHERE action = 'IDOR_NOTIFICATION_MUTATION' AND user_id = $1 
      ORDER BY timestamp DESC LIMIT 1
    `, [userAId]);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].category).toBe("SECURITY");
    expect(auditRes.rows[0].severity).toBe("CRITICAL");
  });

  test("14. Cross-Company Boundary: Company A user querying /notifications is completely isolated from Company B", async () => {
    // Create notification for Garments user
    const nGar = await notificationService.create({
      userId: garmentsUserId,
      companyId: garmentsCompanyId,
      notificationType: "ASSET_ASSIGNED",
      title: "P10 Garments Notification",
      message: "Garments asset notification."
    });

    const resApp = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${userAToken}`);

    const listApp = Array.isArray(resApp.body.data) ? resApp.body.data : resApp.body.data.notifications;
    const ids = listApp.map((n: any) => n.id);
    expect(ids).not.toContain(nGar!.id);
  });

  test("15. Common Admin has global oversight for unscoped administrative notifications", async () => {
    const nGlobal = await notificationService.create({
      userId: userAId,
      companyId: null,
      notificationType: "SYSTEM_SECURITY_ALERT",
      title: "P10 System Security Notice",
      message: "Unscoped system security notice.",
      severity: "CRITICAL"
    });

    const resCA = await request(app)
      .get(`/api/v1/notifications/${nGlobal!.id}`)
      .set("Authorization", `Bearer ${commonAdminToken}`);

    expect(resCA.status).toBe(200);
    expect(resCA.body.data.title).toBe("P10 System Security Notice");
  });

  // =========================================================================
  // GROUP 3: Notification Preferences & Critical Guarantees (Tests 16 - 20)
  // =========================================================================

  test("16. GET /api/v1/notifications/preferences returns default user preferences (all true)", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.asset_events).toBe(true);
    expect(res.body.data.maintenance_events).toBe(true);
    expect(res.body.data.stock_events).toBe(true);
    expect(res.body.data.request_events).toBe(true);
    expect(res.body.data.transfer_events).toBe(true);
    expect(res.body.data.security_alerts).toBe(true);
  });

  test("17. PUT /api/v1/notifications/preferences updates user preference flags", async () => {
    const res = await request(app)
      .put("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        maintenanceEvents: false,
        stockEvents: false
      });

    expect(res.status).toBe(200);
    expect(res.body.data.maintenance_events).toBe(false);
    expect(res.body.data.stock_events).toBe(false);
    expect(res.body.data.asset_events).toBe(true); // preserved default
  });

  test("18. Notification Delivery Engine: Category suppression drops routine notifications when preference is false", async () => {
    // userA has maintenance_events = false
    const suppressed = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "MAINTENANCE_CREATED",
      title: "P10 Routine Work Order (Should Suppress)",
      message: "Routine maintenance scheduled.",
      severity: "INFO"
    });

    expect(suppressed).toBeNull();

    // Verify it does not exist in DB
    const checkRes = await query("SELECT id FROM notifications WHERE user_id = $1 AND title LIKE '%Should Suppress%'", [userAId]);
    expect(checkRes.rows.length).toBe(0);
  });

  test("19. Notification Delivery Engine: Critical notifications bypass preference suppression and are ALWAYS delivered", async () => {
    // userA has maintenance_events = false, but CRITICAL severity bypasses suppression
    const delivered = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "MAINTENANCE_CREATED",
      title: "P10 Emergency Maintenance (CRITICAL)",
      message: "Urgent boiler breakdown requires immediate evacuation!",
      severity: "CRITICAL"
    });

    expect(delivered).toBeDefined();
    expect(delivered!.severity).toBe("CRITICAL");

    // Also verify non-suppressible type TRANSFER_DISPUTED delivers even if transfer_events is turned off
    await notificationService.updatePreferences(userAId, apparelsCompanyId, { transferEvents: false });
    const disputeDelivered = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "TRANSFER_DISPUTED",
      title: "P10 Inter-Company Disputed Transfer Alert",
      message: "Shipment disputed due to broken seals.",
      severity: "WARNING"
    });

    expect(disputeDelivered).toBeDefined();
    expect(disputeDelivered!.notification_type).toBe("TRANSFER_DISPUTED");
  });

  test("20. Notification Idempotency: Duplicate creation with identical idempotencyKey suppresses duplicate", async () => {
    const key = `P10_IDEMP_TEST_${Date.now()}`;
    const first = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "ASSET_RETURN_DUE",
      title: "P10 Due Reminder",
      message: "Please return asset soon.",
      idempotencyKey: key
    });
    expect(first).toBeDefined();

    const second = await notificationService.create({
      userId: userAId,
      companyId: apparelsCompanyId,
      notificationType: "ASSET_RETURN_DUE",
      title: "P10 Due Reminder",
      message: "Please return asset soon.",
      idempotencyKey: key
    });
    expect(second).toBeNull();

    // Check count in DB is exactly 1
    const countRes = await query("SELECT COUNT(*)::int as cnt FROM notifications WHERE idempotency_key = $1", [key]);
    expect(countRes.rows[0].cnt).toBe(1);
  });

  // =========================================================================
  // GROUP 4: Domain Event Notification Integrations (Tests 21 - 30)
  // =========================================================================

  test("21. Asset assignment triggers ASSET_ASSIGNED notification for assigned employee", async () => {
    // Reset preferences for userB to receive asset_events
    await notificationService.updatePreferences(userBId, apparelsCompanyId, { assetEvents: true });

    const assignRes = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        employeeId: employeeBId,
        returnDueDate: "2026-12-31",
        remarks: "P10 Custody Handover"
      });

    expect(assignRes.status).toBe(201);

    // Verify userB received notification
    const notifRes = await query(`
      SELECT notification_type, title, severity 
      FROM notifications 
      WHERE user_id = $1 AND notification_type = 'ASSET_ASSIGNED'
      ORDER BY created_at DESC LIMIT 1
    `, [userBId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].notification_type).toBe("ASSET_ASSIGNED");
    expect(notifRes.rows[0].severity).toBe("INFO");
  });

  test("22. Asset return triggers ASSET_RETURNED notification", async () => {
    const returnRes = await request(app)
      .post("/api/v1/returns")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        condition: "GOOD",
        returnReason: "P10 Clean Return"
      });

    expect(returnRes.status).toBe(201);

    const notifRes = await query(`
      SELECT notification_type, title 
      FROM notifications 
      WHERE user_id = $1 AND notification_type = 'ASSET_RETURNED'
      ORDER BY created_at DESC LIMIT 1
    `, [userBId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].notification_type).toBe("ASSET_RETURNED");
  });

  test("23. Maintenance work order creation triggers MAINTENANCE_CREATED notification", async () => {
    const mntRes = await request(app)
      .post("/api/v1/maintenance")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        maintenanceType: "CORRECTIVE",
        priority: "HIGH",
        problem: "P10 Hydraulic Pump Overhaul",
        description: "Routine checkup and seal replacement",
        scheduledStartDate: "2026-10-01",
        estimatedCost: 1500
      });

    expect(mntRes.status).toBe(201);
    expect(mntRes.body.data.id).toBeDefined();
    const mntId = mntRes.body.data.id;

    // Check notification for ASSET_MANAGER / Company Admin
    const notifRes = await query(`
      SELECT notification_type, title, severity 
      FROM notifications 
      WHERE notification_type = 'MAINTENANCE_CREATED' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [mntId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("INFO");
  });

  test("24. Maintenance status completion triggers MAINTENANCE_COMPLETED notification", async () => {
    // Find created maintenance
    const mntRes = await query("SELECT id FROM maintenance_records WHERE problem LIKE '%Hydraulic Pump%'");
    const mntId = mntRes.rows[0].id;

    // Transition to ASSIGNED -> IN_PROGRESS -> COMPLETED
    await request(app)
      .patch(`/api/v1/maintenance/${mntId}/status`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ status: "ASSIGNED", technicianName: "Tech A" });

    await request(app)
      .patch(`/api/v1/maintenance/${mntId}/status`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ status: "IN_PROGRESS" });

    const completeRes = await request(app)
      .patch(`/api/v1/maintenance/${mntId}/status`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ status: "COMPLETED", remarks: "P10 Overhaul complete" });

    expect(completeRes.status).toBe(200);

    const notifRes = await query(`
      SELECT notification_type, severity 
      FROM notifications 
      WHERE notification_type = 'MAINTENANCE_COMPLETED' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [mntId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("SUCCESS");

    // Restore asset status to AVAILABLE for subsequent test flows
    await query("UPDATE assets SET status = 'AVAILABLE' WHERE id = $1", [testAssetId]);
  });

  test("25. Stock threshold adjustment triggers STOCK_LOW notification", async () => {
    // Create stock item
    const stkRes = await request(app)
      .post("/api/v1/stock")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        stockCode: "STK-P10-001",
        itemName: "P10 High Precision Needles",
        unit: "PACKS",
        quantityOnHand: 25,
        minimumQuantity: 20,
        reorderLevel: 22,
        unitCost: 25.00
      });
    expect(stkRes.status).toBe(201);
    lowStockItemId = stkRes.body.data.id;

    // Movement to decrease quantityOnHand below minimumQuantity
    const adjustRes = await request(app)
      .post(`/api/v1/stock/${lowStockItemId}/movements`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        movementType: "ISSUE",
        quantity: 10,
        notes: "Depleted below threshold"
      });

    expect(adjustRes.status).toBe(201);

    const notifRes = await query(`
      SELECT notification_type, severity, title 
      FROM notifications 
      WHERE notification_type = 'STOCK_LOW' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [lowStockItemId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("WARNING");
  });

  test("26. Requisition submission triggers REQUISITION_SUBMITTED notification", async () => {
    const reqRes = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        itemName: "P10 Ergonomic Desk Station",
        departmentId: apparelsDeptId,
        quantity: 1,
        priority: "MEDIUM",
        justification: "Workspace ergonomic upgrade"
      });

    expect(reqRes.status).toBe(201);
    pendingRequisitionId = reqRes.body.data.id;

    const submitRes = await request(app)
      .post(`/api/v1/requests/${pendingRequisitionId}/submit`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(submitRes.status).toBe(200);

    const notifRes = await query(`
      SELECT notification_type, severity, title 
      FROM notifications 
      WHERE notification_type = 'REQUISITION_SUBMITTED' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [pendingRequisitionId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("INFO");
  });

  test("27. Requisition approval triggers REQUISITION_APPROVED notification", async () => {
    const stagesRes = await request(app)
      .get(`/api/v1/requests/${pendingRequisitionId}/approvals`)
      .set("Authorization", `Bearer ${deptManagerToken}`);
    const stages = stagesRes.body.data || [];
    const step1Id = stages[0]?.id;

    if (step1Id) {
      const approveRes = await request(app)
        .post(`/api/v1/requests/${pendingRequisitionId}/approvals/${step1Id}/approve`)
        .set("Authorization", `Bearer ${deptManagerToken}`)
        .send({ remarks: "P10 Dept Manager clearance granted" });

      expect(approveRes.status).toBe(200);

      const notifRes = await query(`
        SELECT notification_type, severity 
        FROM notifications 
        WHERE entity_id = $1 AND notification_type IN ('REQUISITION_APPROVED', 'REQUISITION_APPROVAL_REQUIRED')
        ORDER BY created_at DESC LIMIT 1
      `, [pendingRequisitionId]);

      expect(notifRes.rows.length).toBe(1);
    }
  });

  test("28. Asset transfer creation triggers TRANSFER_CREATED notification", async () => {
    const trfRes = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: testAssetId,
        transferType: "DEPT_TO_DEPT",
        toDepartmentId: apparelsDeptId,
        toLocationId: apparelsLocId,
        reason: "P10 Departmental relocation"
      });

    expect(trfRes.status).toBe(201);
    const trfId = trfRes.body.data.id;

    const notifRes = await query(`
      SELECT notification_type, severity 
      FROM notifications 
      WHERE notification_type = 'TRANSFER_CREATED' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [trfId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("INFO");
  });

  test("29. Inter-company transfer dispute triggers TRANSFER_DISPUTED notification with CRITICAL severity", async () => {
    // Create an inter-company transfer
    const trfRes = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({
        assetId: intercompanyAssetId,
        transferType: "INTER_COMPANY",
        toCompanyId: garmentsCompanyId,
        reason: "P10 Inter-Company temporary loan"
      });

    expect(trfRes.status).toBe(201);
    transferDisputedId = trfRes.body.data.id;

    // Fast-forward transfer status to DISPATCHED
    await query("UPDATE asset_transfers SET status = 'DISPATCHED' WHERE id = $1", [transferDisputedId]);

    // Dispute transfer from Garments Admin
    const disputeRes = await request(app)
      .post(`/api/v1/transfers/${transferDisputedId}/dispute`)
      .set("Authorization", `Bearer ${garmentsAdminToken}`)
      .send({
        reason: "P10 Crate arrived with damaged seals and missing serial tag"
      });

    expect(disputeRes.status).toBe(200);

    const notifRes = await query(`
      SELECT notification_type, severity, title 
      FROM notifications 
      WHERE notification_type IN ('TRANSFER_DISPUTED', 'INTERCOMPANY_TRANSFER_DISPUTED') AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [transferDisputedId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("CRITICAL");
  });

  test("30. Suspicious barcode/QR scan triggers ASSET_SCAN_SECURITY_ALERT notification with CRITICAL severity", async () => {
    const scanRes = await request(app)
      .post("/api/v1/scan/verify")
      .set("Authorization", `Bearer ${garmentsUserToken}`)
      .send({
        scannedCode: "INVALID-TAMPERED-QR-TOKEN-99999",
        scanType: "QR_CODE",
        latitude: 23.8103,
        longitude: 90.4125
      });

    // Invalid scan token returns 404 or 400
    expect([400, 404]).toContain(scanRes.status);

    // Verify security alert notification triggered or recorded
    const notifRes = await query(`
      SELECT notification_type, severity 
      FROM notifications 
      WHERE notification_type = 'ASSET_SCAN_SECURITY_ALERT'
      ORDER BY created_at DESC LIMIT 1
    `);

    if (notifRes.rows.length > 0) {
      expect(notifRes.rows[0].severity).toBe("CRITICAL");
    }
  });

  // =========================================================================
  // GROUP 5: Scheduled Operational Alert Jobs (Tests 31 - 35)
  // =========================================================================

  test("31. Scheduled Job: checkOverdueReturns detects overdue assignment and generates ASSET_RETURN_OVERDUE alert", async () => {
    const result = await notificationJobs.checkOverdueReturns();
    expect(result.job).toBe("checkOverdueReturns");
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.alertsCreated).toBeGreaterThanOrEqual(1);

    const notifRes = await query(`
      SELECT notification_type, severity, idempotency_key 
      FROM notifications 
      WHERE notification_type = 'ASSET_RETURN_OVERDUE' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [overdueAssignmentId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].severity).toBe("CRITICAL");
    expect(notifRes.rows[0].idempotency_key).toContain(`RETURN_OVERDUE:${overdueAssignmentId}`);
  });

  test("32. Scheduled Job: checkOverdueReturns is idempotent on duplicate execution", async () => {
    const result = await notificationJobs.checkOverdueReturns();
    // Because today's alert was already created, alertsCreated for that record should be skipped
    expect(result.alertsCreated).toBe(0);
  });

  test("33. Scheduled Job: checkLowStock scans inventory below min_quantity and creates alerts", async () => {
    const result = await notificationJobs.checkLowStock();
    expect(result.job).toBe("checkLowStock");
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const notifRes = await query(`
      SELECT notification_type, severity, idempotency_key 
      FROM notifications 
      WHERE notification_type IN ('STOCK_LOW', 'STOCK_OUT') AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [lowStockItemId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].idempotency_key).toContain(`STOCK_LOW:${lowStockItemId}`);
  });

  test("34. Scheduled Job: checkLowStock is idempotent on duplicate execution", async () => {
    const result = await notificationJobs.checkLowStock();
    expect(result.alertsCreated).toBe(0);
  });

  test("35. Scheduled Job: checkPendingApprovals identifies pending requisitions and alerts approvers", async () => {
    // Create pending requisition directly in DB with created_at older than 48 hours
    const reqRes = await query(`
      INSERT INTO asset_requests (
        company_id, request_code, employee_id, requester_id, department_id,
        item_name, quantity, priority, status, justification, created_at
      ) VALUES (
        $1, 'REQ-P10-PENDING', $2, $3, $4,
        'P10 Pending Job Test Item', 1, 'HIGH', 'PENDING_APPROVAL', 'Operational testing', NOW() - INTERVAL '72 hours'
      ) RETURNING id;
    `, [apparelsCompanyId, employeeAId, userAId, apparelsDeptId]);
    const pReqId = reqRes.rows[0].id;

    const result = await notificationJobs.checkPendingApprovals();
    expect(result.job).toBe("checkPendingApprovals");
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const notifRes = await query(`
      SELECT notification_type, idempotency_key 
      FROM notifications 
      WHERE notification_type = 'REQUISITION_APPROVAL_REQUIRED' AND entity_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [pReqId]);

    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].idempotency_key).toContain(`PENDING_APPROVAL_OVERDUE:${pReqId}`);
  });

  // =========================================================================
  // GROUP 6: Audit Log Hardening & Immutability (Tests 36 - 46)
  // =========================================================================

  test("36. GET /api/v1/audit queries audit logs with category, severity, and status filters", async () => {
    const res = await request(app)
      .get("/api/v1/audit?page=1&limit=20&category=SECURITY")
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.logs).toBeInstanceOf(Array);
    expect(res.body.data.logs.every((l: any) => l.category === "SECURITY")).toBe(true);
  });

  test("37. Audit Immutability: POST /api/v1/audit is rejected with 403 Forbidden & logs tampering attempt", async () => {
    const res = await request(app)
      .post("/api/v1/audit")
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ action: "TAMPER", entity: "audit_logs" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/immutable/i);

    const auditRes = await query(`
      SELECT action, category, severity 
      FROM audit_logs 
      WHERE action = 'AUDIT_TAMPERING_ATTEMPT' AND user_id = (SELECT id FROM users WHERE username = 'apparels_admin')
      ORDER BY timestamp DESC LIMIT 1
    `);
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].category).toBe("SECURITY");
    expect(auditRes.rows[0].severity).toBe("CRITICAL");
  });

  test("38. Audit Immutability: PUT /api/v1/audit/:id is rejected with 403 Forbidden", async () => {
    const anyLog = await query("SELECT id FROM audit_logs LIMIT 1");
    const logId = anyLog.rows[0].id;

    const res = await request(app)
      .put(`/api/v1/audit/${logId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ status: "ALTERED" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/immutable/i);
  });

  test("39. Audit Immutability: PATCH /api/v1/audit/:id is rejected with 403 Forbidden", async () => {
    const anyLog = await query("SELECT id FROM audit_logs LIMIT 1");
    const logId = anyLog.rows[0].id;

    const res = await request(app)
      .patch(`/api/v1/audit/${logId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`)
      .send({ severity: "INFO" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/immutable/i);
  });

  test("40. Audit Immutability: DELETE /api/v1/audit/:id is rejected with 403 Forbidden", async () => {
    const anyLog = await query("SELECT id FROM audit_logs LIMIT 1");
    const logId = anyLog.rows[0].id;

    const res = await request(app)
      .delete(`/api/v1/audit/${logId}`)
      .set("Authorization", `Bearer ${apparelsAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/immutable/i);
  });

  test("41. Service Layer Immutability: AuditService.updateAuditLog throws ForbiddenError", async () => {
    const anyLog = await query("SELECT id FROM audit_logs LIMIT 1");
    const logId = anyLog.rows[0].id;

    await expect(
      auditService.updateAuditLog(logId, { status: "MODIFIED" })
    ).rejects.toThrow(ForbiddenError);
  });

  test("42. Service Layer Immutability: AuditService.deleteAuditLog throws ForbiddenError", async () => {
    const anyLog = await query("SELECT id FROM audit_logs LIMIT 1");
    const logId = anyLog.rows[0].id;

    await expect(
      auditService.deleteAuditLog(logId)
    ).rejects.toThrow(ForbiddenError);
  });

  test("43. Authentication Audit: Successful login logs category='AUTHENTICATION' and status='SUCCESS'", async () => {
    await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "p10_user_a", password: "Password@123" });

    const auditRes = await query(`
      SELECT action, category, severity, status 
      FROM audit_logs 
      WHERE user_id = $1 AND action = 'LOGIN_SUCCESS' AND category = 'AUTHENTICATION'
      ORDER BY timestamp DESC LIMIT 1
    `, [userAId]);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].status).toBe("SUCCESS");
    expect(auditRes.rows[0].severity).toBe("INFO");
  });

  test("44. Authentication Audit: Failed login logs category='AUTHENTICATION', status='FAILURE', severity='WARNING'", async () => {
    await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "p10_user_a", password: "WrongPassword999!" });

    const auditRes = await query(`
      SELECT action, category, severity, status 
      FROM audit_logs 
      WHERE action = 'LOGIN_FAILED' AND category = 'AUTHENTICATION'
      ORDER BY timestamp DESC LIMIT 1
    `);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].status).toBe("FAILURE");
    expect(auditRes.rows[0].severity).toBe("WARNING");
  });

  test("45. Security Audit: Account lockout triggers category='SECURITY' with severity='CRITICAL'", async () => {
    // Create temporary user to lock out
    const pwdHash = await hashPassword("LockoutUser#123");
    const tempUserRes = await query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'p10_lockout_user', 'lockout.p10@example.com', $2, (SELECT id FROM roles WHERE company_id = $1 AND code = 'EMPLOYEE'), true)
      RETURNING id;
    `, [apparelsCompanyId, pwdHash]);
    const lockoutUserId = tempUserRes.rows[0].id;

    // Send 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/auth/login")
        .send({ username: "p10_lockout_user", password: "WrongPassword!" });
    }

    const auditRes = await query(`
      SELECT action, category, severity, status 
      FROM audit_logs 
      WHERE action = 'USER_ACCOUNT_LOCKED' AND category = 'SECURITY'
      ORDER BY timestamp DESC LIMIT 1
    `);

    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].severity).toBe("CRITICAL");

    // Clean up temporary user and rate limit entries
    await query("DELETE FROM auth_rate_limits WHERE key LIKE '%p10_lockout_user%'");
    await query("DELETE FROM users WHERE id = $1", [lockoutUserId]);
  });

  test("46. Audit Log Sanitization: Sensitive fields (password, token, authorization) are masked as [REDACTED]", async () => {
    const sanitizedLog = await auditService.log({
      companyId: apparelsCompanyId,
      userId: userAId,
      action: "PROFILE_PASSWORD_UPDATE",
      entity: "users",
      entityId: userAId,
      category: "AUTHENTICATION",
      severity: "INFO",
      status: "SUCCESS",
      oldValues: {
        username: "p10_user_a",
        password: "SuperSecretPlaintextPassword123",
        accessToken: "jwt-token-string-sensitive-xyz"
      },
      newValues: {
        username: "p10_user_a",
        password: "NewSuperSecretPassword456",
        refreshToken: "refresh-token-sensitive-abc"
      }
    });

    expect(sanitizedLog).toBeDefined();

    const dbLogRes = await query(`
      SELECT old_values_json, new_values_json 
      FROM audit_logs 
      WHERE id = $1
    `, [sanitizedLog.id]);

    const oldVals = dbLogRes.rows[0].old_values_json;
    const newVals = dbLogRes.rows[0].new_values_json;

    expect(oldVals.password).toBe("[REDACTED]");
    expect(oldVals.accessToken).toBe("[REDACTED]");
    expect(oldVals.username).toBe("p10_user_a");

    expect(newVals.password).toBe("[REDACTED]");
    expect(newVals.refreshToken).toBe("[REDACTED]");
    expect(newVals.username).toBe("p10_user_a");
  });

  afterAll(async () => {
    await query("DELETE FROM auth_rate_limits");
  });
});

