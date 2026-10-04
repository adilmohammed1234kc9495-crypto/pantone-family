import { withTransaction } from "../config/database";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { hashPassword } from "../utils/crypto";

export async function runSeed(): Promise<void> {
  logger.info("Starting enterprise database seed...");

  await withTransaction(async (client) => {
    // 1. Seed Permissions
    const permissions = [
      // Companies
      { code: "companies:view", module: "companies", action: "view", description: "View company details" },
      { code: "companies:manage", module: "companies", action: "manage", description: "Create and update companies" },
      // Users & Roles
      { code: "users:view", module: "users", action: "view", description: "View user directory" },
      { code: "users:manage", module: "users", action: "manage", description: "Manage users and credentials" },
      { code: "roles:view", module: "roles", action: "view", description: "View role definitions" },
      { code: "roles:manage", module: "roles", action: "manage", description: "Manage role permissions" },
      { code: "permissions:view", module: "permissions", action: "view", description: "View permission master list" },
      { code: "permissions:assign", module: "permissions", action: "assign", description: "Assign direct user permissions" },
      // Organization Units
      { code: "branches:view", module: "branches", action: "view", description: "View branches" },
      { code: "branches:manage", module: "branches", action: "manage", description: "Manage branches" },
      { code: "departments:view", module: "departments", action: "view", description: "View departments" },
      { code: "departments:manage", module: "departments", action: "manage", description: "Manage departments" },
      { code: "locations:view", module: "locations", action: "view", description: "View locations" },
      { code: "locations:manage", module: "locations", action: "manage", description: "Manage locations" },
      { code: "employees:view", module: "employees", action: "view", description: "View employee profiles" },
      { code: "employees:manage", module: "employees", action: "manage", description: "Manage employee profiles" },
      { code: "vendors:view", module: "vendors", action: "view", description: "View vendors" },
      { code: "vendors:manage", module: "vendors", action: "manage", description: "Manage vendors" },
      { code: "categories:view", module: "categories", action: "view", description: "View asset categories" },
      { code: "categories:manage", module: "categories", action: "manage", description: "Manage asset categories" },
      // Asset Lifecycle
      { code: "assets:view", module: "assets", action: "view", description: "View asset catalog" },
      { code: "assets:create", module: "assets", action: "create", description: "Register new fixed assets" },
      { code: "assets:edit", module: "assets", action: "edit", description: "Edit asset metadata and valuation" },
      { code: "assets:retire", module: "assets", action: "retire", description: "Decommission or retire assets" },
      { code: "assets:dispose", module: "assets", action: "dispose", description: "Permanently dispose of assets" },
      // Stock
      { code: "stock:view", module: "stock", action: "view", description: "View warehouse stock" },
      { code: "stock:manage", module: "stock", action: "manage", description: "Stock in and stock out movements" },
      // Requests & Approvals
      { code: "requests:view", module: "requests", action: "view", description: "View asset requests" },
      { code: "requests:create", module: "requests", action: "create", description: "Submit asset acquisition request" },
      { code: "requests:approve", module: "requests", action: "approve", description: "Approve or reject asset requests" },
      // Custody Assignments & Returns
      { code: "assignments:view", module: "assignments", action: "view", description: "View asset assignments" },
      { code: "assignments:assign", module: "assignments", action: "assign", description: "Assign assets to employees" },
      { code: "assignments:return", module: "assignments", action: "return", description: "Inspect and accept asset returns" },
      // Transfers & Handover
      { code: "transfers:view", module: "transfers", action: "view", description: "View asset transfer logs" },
      { code: "transfers:internal", module: "transfers", action: "internal", description: "Execute internal asset transfers" },
      { code: "transfers:inter_company", module: "transfers", action: "inter_company", description: "Execute inter-company transfers" },
      { code: "handovers:view", module: "handovers", action: "view", description: "View physical handover records" },
      { code: "handovers:sign", module: "handovers", action: "sign", description: "Sign digital handover acknowledgement" },
      // Maintenance
      { code: "maintenance:view", module: "maintenance", action: "view", description: "View maintenance orders" },
      { code: "maintenance:log", module: "maintenance", action: "log", description: "Report breakdown or issue" },
      { code: "maintenance:manage", module: "maintenance", action: "manage", description: "Manage vendor repair and cost" },
      // QR & Reports & Audit
      { code: "qr:generate", module: "qr", action: "generate", description: "Generate QR codes and asset tags" },
      { code: "qr:scan", module: "qr", action: "scan", description: "Perform optical QR search" },
      { code: "reports:view", module: "reports", action: "view", description: "View financial and asset reports" },
      { code: "reports:export", module: "reports", action: "export", description: "Export PDF and CSV reports" },
      { code: "audit:view", module: "audit", action: "view", description: "View immutable system audit logs" },
      { code: "notifications:view", module: "notifications", action: "view", description: "Receive system notifications" },
      { code: "settings:view", module: "settings", action: "view", description: "View system configurations" },
      { code: "settings:manage", module: "settings", action: "manage", description: "Modify system configurations" }
    ];

    for (const p of permissions) {
      await client.query(`
        INSERT INTO permissions (code, module, action, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE SET
          module = EXCLUDED.module,
          action = EXCLUDED.action,
          description = EXCLUDED.description
      `, [p.code, p.module, p.action, p.description]);
    }
    logger.info(`Seeded ${permissions.length} master permissions.`);

    // 2. Seed Companies
    // Company 1: Pantone Apparels
    const apparelsRes = await client.query(`
      INSERT INTO companies (code, name, tax_id, address, phone, email, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, code, name
    `, [
      "PANTONE-APP",
      "Pantone Apparels",
      "TAX-APP-9812",
      "Plot 14, Textile Industrial Area, Sector 5",
      "+91-11-45678901",
      "contact@pantone-apparels.com"
    ]);
    const apparelsCompanyId = apparelsRes.rows[0].id;

    // Company 2: Pantone Garments
    const garmentsRes = await client.query(`
      INSERT INTO companies (code, name, tax_id, address, phone, email, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, code, name
    `, [
      "PANTONE-GAR",
      "Pantone Garments",
      "TAX-GAR-4421",
      "Plot 28, Garment Export Park, Sector 8",
      "+91-11-45678902",
      "contact@pantone-garments.com"
    ]);
    const garmentsCompanyId = garmentsRes.rows[0].id;
    logger.info("Seeded core companies: Pantone Apparels & Pantone Garments.");

    // 3. Seed Global Common Admin Role
    const commonAdminRoleRes = await client.query(`
      INSERT INTO roles (company_id, code, name, description, is_system_role)
      VALUES (NULL, 'COMMON_ADMIN', 'Common Administrator', 'Global cross-company administrator with full access', true)
      ON CONFLICT (code) WHERE company_id IS NULL DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const commonAdminRoleId = commonAdminRoleRes.rows[0].id;

    // Grant all permissions to COMMON_ADMIN
    const allPerms = await client.query<{ id: string }>("SELECT id FROM permissions");
    for (const p of allPerms.rows) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `, [commonAdminRoleId, p.id]);
    }

    // Helper function to seed company-level roles
    async function seedCompanyRoles(companyId: string, _companyCode: string) {
      // Company Admin
      const coAdminRes = await client.query(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, 'COMPANY_ADMIN', 'Company Administrator', 'Full administrative authority within company', true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId]);
      const coAdminRoleId = coAdminRes.rows[0].id;

      // Asset Manager
      const assetMgrRes = await client.query(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, 'ASSET_MANAGER', 'Asset Manager', 'Operational control over assets, stock, and handovers', true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId]);
      const assetMgrRoleId = assetMgrRes.rows[0].id;

      // Department Manager
      const deptMgrRes = await client.query(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, 'DEPT_MANAGER', 'Department Manager', 'Departmental asset oversight and request approvals', true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId]);
      const deptMgrRoleId = deptMgrRes.rows[0].id;

      // Employee
      const empRoleRes = await client.query(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, 'EMPLOYEE', 'Employee', 'Employee self-service custody and requests', true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId]);
      const empRoleId = empRoleRes.rows[0].id;

      // Auditor
      const audRoleRes = await client.query(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, 'AUDITOR', 'Auditor', 'Read-only compliance and reporting access', true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId]);
      const audRoleId = audRoleRes.rows[0].id;

      // Assign company-level permissions to Company Admin (all except global companies:manage)
      const coPerms = await client.query<{ id: string }>(
        "SELECT id FROM permissions WHERE code != 'companies:manage'"
      );
      for (const p of coPerms.rows) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `, [coAdminRoleId, p.id]);
      }

      return { coAdminRoleId, assetMgrRoleId, deptMgrRoleId, empRoleId, audRoleId };
    }

    const apparelsRoles = await seedCompanyRoles(apparelsCompanyId, "PANTONE-APP");
    const garmentsRoles = await seedCompanyRoles(garmentsCompanyId, "PANTONE-GAR");
    logger.info("Seeded standard company roles and permission assignments.");

    // 4. Seed Branches & Departments
    const appBranchRes = await client.query(`
      INSERT INTO branches (company_id, code, name, city, state)
      VALUES ($1, 'HQ-DEL', 'Apparels Delhi HQ', 'New Delhi', 'Delhi')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [apparelsCompanyId]);
    const appBranchId = appBranchRes.rows[0].id;

    await client.query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES 
        ($1, $2, 'DEPT-CUT', 'Cutting & Pattern Department'),
        ($1, $2, 'DEPT-SEW', 'Stitching & Sewing Floor'),
        ($1, $2, 'DEPT-FIN', 'Finishing & Packaging')
      ON CONFLICT (company_id, code) DO NOTHING
    `, [apparelsCompanyId, appBranchId]);

    const garBranchRes = await client.query(`
      INSERT INTO branches (company_id, code, name, city, state)
      VALUES ($1, 'HQ-NOI', 'Garments Noida Plant', 'Noida', 'Uttar Pradesh')
      ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [garmentsCompanyId]);
    const garBranchId = garBranchRes.rows[0].id;

    await client.query(`
      INSERT INTO departments (company_id, branch_id, code, name)
      VALUES 
        ($1, $2, 'DEPT-FAB', 'Fabric Inspection & Weaving'),
        ($1, $2, 'DEPT-ASY', 'Garment Assembly'),
        ($1, $2, 'DEPT-LOG', 'Logistics & Dispatch')
      ON CONFLICT (company_id, code) DO NOTHING
    `, [garmentsCompanyId, garBranchId]);

    // 5. Seed Users
    // 5a. Common Admin (company_id = NULL)
    const commonAdminPassHash = await hashPassword(env.SEED_COMMON_ADMIN_PASSWORD);
    await client.query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES (NULL, 'common_admin', 'admin@pantone.com', $1, $2, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
    `, [commonAdminPassHash, commonAdminRoleId]);

    // 5b. Pantone Apparels Admin
    const apparelsAdminPassHash = await hashPassword(env.SEED_APPARELS_ADMIN_PASSWORD);
    await client.query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'apparels_admin', 'admin@pantone-apparels.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
    `, [apparelsCompanyId, apparelsAdminPassHash, apparelsRoles.coAdminRoleId]);

    // 5c. Pantone Garments Admin
    const garmentsAdminPassHash = await hashPassword(env.SEED_GARMENTS_ADMIN_PASSWORD);
    await client.query(`
      INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
      VALUES ($1, 'garments_admin', 'admin@pantone-garments.com', $2, $3, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
    `, [garmentsCompanyId, garmentsAdminPassHash, garmentsRoles.coAdminRoleId]);

    logger.info("Seeded administrator accounts for Common Admin, Pantone Apparels, and Pantone Garments.");
  });

  logger.info("Database seed successfully completed.");
}

if (require.main === module) {
  runSeed()
    .then(() => {
      logger.info("Seed script finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error("Seed script failed", { error: err.message, stack: err.stack });
      process.exit(1);
    });
}