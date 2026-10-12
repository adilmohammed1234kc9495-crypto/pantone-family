import { query } from "../config/database";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { hashPassword } from "../utils/crypto";

export async function runSeed(): Promise<void> {
  logger.info("Starting enterprise database seed (WAN/PgBouncer optimized)...");

  // 1. Seed Permissions in a single batched query
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

  const permPlaceholders = permissions.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ");
  const permValues = permissions.flatMap(p => [p.code, p.module, p.action, p.description]);
  await query(`
    INSERT INTO permissions (code, module, action, description)
    VALUES ${permPlaceholders}
    ON CONFLICT (code) DO UPDATE SET
      module = EXCLUDED.module,
      action = EXCLUDED.action,
      description = EXCLUDED.description
  `, permValues);
  logger.info(`Seeded ${permissions.length} master permissions.`);

  // 2. Seed Core Companies
  const apparelsRes = await query<{ id: string }>(`
    INSERT INTO companies (code, name, tax_id, address, phone, email, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [
    "PANTONE-APP",
    "Pantone Apparels",
    "TAX-APP-9812",
    "Plot 14, Textile Industrial Area, Sector 5",
    "+91-11-45678901",
    "contact@pantone-apparels.com"
  ]);
  const apparelsCompanyId = apparelsRes.rows[0].id;

  const garmentsRes = await query<{ id: string }>(`
    INSERT INTO companies (code, name, tax_id, address, phone, email, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
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
  const commonAdminRoleRes = await query<{ id: string }>(`
    INSERT INTO roles (company_id, code, name, description, is_system_role)
    VALUES (NULL, 'COMMON_ADMIN', 'Common Administrator', 'Global cross-company administrator with full access', true)
    ON CONFLICT (code) WHERE company_id IS NULL DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const commonAdminRoleId = commonAdminRoleRes.rows[0].id;

  // Grant all permissions to COMMON_ADMIN
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, id FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `, [commonAdminRoleId]);

  // Helper function to seed company-level roles
  async function seedCompanyRoles(companyId: string) {
    const roleDefs = [
      { code: "COMPANY_ADMIN", name: "Company Administrator", desc: "Full administrative authority within company" },
      { code: "ASSET_MANAGER", name: "Asset Manager", desc: "Operational control over assets, stock, and handovers" },
      { code: "DEPT_MANAGER", name: "Department Manager", desc: "Departmental asset oversight and request approvals" },
      { code: "EMPLOYEE", name: "Employee", desc: "Employee self-service custody and requests" },
      { code: "AUDITOR", name: "Auditor", desc: "Read-only compliance and reporting access" },
    ];

    const roleMap: Record<string, string> = {};
    for (const r of roleDefs) {
      const res = await query<{ id: string }>(`
        INSERT INTO roles (company_id, code, name, description, is_system_role)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyId, r.code, r.name, r.desc]);
      roleMap[r.code] = res.rows[0].id;
    }

    // Assign company permissions to Company Admin (all except companies:manage)
    await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT $1, id FROM permissions WHERE code != 'companies:manage'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `, [roleMap["COMPANY_ADMIN"]]);

    return roleMap;
  }

  const apparelsRoles = await seedCompanyRoles(apparelsCompanyId);
  const garmentsRoles = await seedCompanyRoles(garmentsCompanyId);
  logger.info("Seeded standard company roles and permission assignments.");

  // 4. Seed Branches & Departments
  const appBranchRes = await query<{ id: string }>(`
    INSERT INTO branches (company_id, code, name, city, state)
    VALUES ($1, 'HQ-DEL', 'Apparels Delhi HQ', 'New Delhi', 'Delhi')
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [apparelsCompanyId]);
  const appBranchId = appBranchRes.rows[0].id;

  await query(`
    INSERT INTO departments (company_id, branch_id, code, name)
    VALUES 
      ($1, $2, 'DEPT-CUT', 'Cutting & Pattern Department'),
      ($1, $2, 'DEPT-SEW', 'Stitching & Sewing Floor'),
      ($1, $2, 'DEPT-FIN', 'Finishing & Packaging')
    ON CONFLICT (company_id, code) DO NOTHING
  `, [apparelsCompanyId, appBranchId]);

  const garBranchRes = await query<{ id: string }>(`
    INSERT INTO branches (company_id, code, name, city, state)
    VALUES ($1, 'HQ-NOI', 'Garments Noida Plant', 'Noida', 'Uttar Pradesh')
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [garmentsCompanyId]);
  const garBranchId = garBranchRes.rows[0].id;

  await query(`
    INSERT INTO departments (company_id, branch_id, code, name)
    VALUES 
      ($1, $2, 'DEPT-FAB', 'Fabric Inspection & Weaving'),
      ($1, $2, 'DEPT-ASY', 'Garment Assembly'),
      ($1, $2, 'DEPT-LOG', 'Logistics & Dispatch')
    ON CONFLICT (company_id, code) DO NOTHING
  `, [garmentsCompanyId, garBranchId]);
  logger.info("Seeded branches and departments for both companies.");

  // 5. Seed Users
  const [commonAdminPassHash, apparelsAdminPassHash, garmentsAdminPassHash] = await Promise.all([
    hashPassword(env.SEED_COMMON_ADMIN_PASSWORD),
    hashPassword(env.SEED_APPARELS_ADMIN_PASSWORD),
    hashPassword(env.SEED_GARMENTS_ADMIN_PASSWORD),
  ]);

  await query(`
    INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
    VALUES (NULL, 'common_admin', 'admin@pantone.com', $1, $2, true)
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
  `, [commonAdminPassHash, commonAdminRoleId]);

  await query(`
    INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
    VALUES ($1, 'apparels_admin', 'admin@pantone-apparels.com', $2, $3, true)
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
  `, [apparelsCompanyId, apparelsAdminPassHash, apparelsRoles["COMPANY_ADMIN"]]);

  await query(`
    INSERT INTO users (company_id, username, email, password_hash, role_id, is_active)
    VALUES ($1, 'garments_admin', 'admin@pantone-garments.com', $2, $3, true)
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id
  `, [garmentsCompanyId, garmentsAdminPassHash, garmentsRoles["COMPANY_ADMIN"]]);
  logger.info("Seeded administrator accounts for Common Admin, Pantone Apparels, and Pantone Garments.");

  // 6. Seed Master Asset Categories (Root & Subcategories)
  const rootCategories = [
    { code: "MACH", name: "Production Machinery & Industrial Equipment", description: "Heavy stitching, cutting, spreading, and embroidery machinery", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { code: "FAC", name: "Plant Infrastructure & Utility Systems", description: "Facility backup generators, boilers, and compressor systems", method: "STRAIGHT_LINE", rate: 10.0, months: 120 },
    { code: "IT", name: "IT, Computing & Network Infrastructure", description: "CAD pattern stations, servers, label printers, and barcode scanners", method: "STRAIGHT_LINE", rate: 33.33, months: 36 },
    { code: "MAT", name: "Material Handling & Storage Systems", description: "Forklifts, pallet trucks, and high-density warehouse storage racks", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { code: "FURN", name: "Factory & Ergonomic Office Furniture", description: "Industrial sewing chairs, inspection tables, and office work desks", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { code: "VEH", name: "Logistics & Transport Fleet", description: "Internal transfer delivery vans, trucks, and facility utility vehicles", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { code: "LAB", name: "Quality Assurance & Testing Equipment", description: "Fabric tensile testing, color fastness matching, and precision scales", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
  ];

  const rootCatMap = new Map<string, string>();
  for (const cat of rootCategories) {
    const res = await query<{ id: string; code: string }>(`
      INSERT INTO asset_categories (company_id, code, name, description, depreciation_method, depreciation_rate_percent, useful_life_months, parent_id, is_active)
      VALUES (NULL, $1, $2, $3, $4, $5, $6, NULL, true)
      ON CONFLICT (code) WHERE company_id IS NULL DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        depreciation_method = EXCLUDED.depreciation_method,
        depreciation_rate_percent = EXCLUDED.depreciation_rate_percent,
        useful_life_months = EXCLUDED.useful_life_months
      RETURNING id, code
    `, [cat.code, cat.name, cat.description, cat.method, cat.rate, cat.months]);
    rootCatMap.set(cat.code, res.rows[0].id);
  }

  const subCategories = [
    { parentCode: "MACH", code: "MACH-SEW", name: "Industrial Lockstitch & Overlock Sewing Machines", description: "Single-needle lockstitch, 4-thread overlock, and blind stitch units", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { parentCode: "MACH", code: "MACH-CUT", name: "CNC Fabric Cutting & Spreading Systems", description: "Computerized automatic fabric spreading and CNC knife cutting tables", method: "STRAIGHT_LINE", rate: 14.28, months: 84 },
    { parentCode: "MACH", code: "MACH-FIN", name: "Steam Ironing & Vacuum Finishing Stations", description: "High-pressure boiler steam irons, vacuum tables, and thread trimmers", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
    { parentCode: "MACH", code: "MACH-EMB", name: "Multi-Head Computerized Embroidery Machines", description: "12-head and 20-head high-speed embroidery and monogramming machines", method: "STRAIGHT_LINE", rate: 14.28, months: 84 },
    { parentCode: "IT", code: "IT-SRV", name: "Enterprise Server Racks & Network Switches", description: "On-premise database servers, firewalls, and industrial managed switches", method: "STRAIGHT_LINE", rate: 33.33, months: 36 },
    { parentCode: "IT", code: "IT-CAD", name: "Pattern Design & CAD Workstations", description: "Gerber/Lectra pattern grading and marker-making CAD computers", method: "STRAIGHT_LINE", rate: 33.33, months: 36 },
    { parentCode: "IT", code: "IT-PRN", name: "Industrial QR & Barcode Label Printers", description: "Thermal transfer high-speed asset barcode and QR tag printers", method: "STRAIGHT_LINE", rate: 33.33, months: 36 },
    { parentCode: "FAC", code: "FAC-GEN", name: "Diesel Power Generators & Auto-Switch Panels", description: "500 kVA soundproof acoustic diesel generator sets with AMF panels", method: "STRAIGHT_LINE", rate: 10.0, months: 120 },
    { parentCode: "FAC", code: "FAC-CMP", name: "Rotary Screw Compressors & Air Dryers", description: "Oil-free screw compressors delivering pneumatic air to sewing floors", method: "STRAIGHT_LINE", rate: 10.0, months: 120 },
    { parentCode: "MAT", code: "MAT-FRK", name: "Electric Forklifts & Walkie Reach Trucks", description: "3-ton battery electric warehouse forklifts with mast height 4.5m", method: "STRAIGHT_LINE", rate: 20.0, months: 60 },
  ];

  for (const sub of subCategories) {
    const parentId = rootCatMap.get(sub.parentCode) || null;
    await query(`
      INSERT INTO asset_categories (company_id, code, name, description, depreciation_method, depreciation_rate_percent, useful_life_months, parent_id, is_active)
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (code) WHERE company_id IS NULL DO UPDATE SET
        name = EXCLUDED.name,
        parent_id = EXCLUDED.parent_id,
        description = EXCLUDED.description,
        depreciation_method = EXCLUDED.depreciation_method,
        depreciation_rate_percent = EXCLUDED.depreciation_rate_percent,
        useful_life_months = EXCLUDED.useful_life_months
    `, [sub.code, sub.name, sub.description, sub.method, sub.rate, sub.months, parentId]);
  }
  logger.info("Seeded hierarchical master asset categories (7 root categories + 10 subcategories).");

  // 7. Seed Physical Locations with Code and Name
  const locations = [
    // Apparels Locations (Delhi HQ)
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-CUT", name: "Cutting & CAD Section", building: "Main Apparel Plant", floor: "Ground Floor", roomNumber: "Bay A - Cutting Section", description: "CNC Fabric cutting, spreading and pattern plotting tables" },
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-SEW1", name: "Stitching Line 1", building: "Main Apparel Plant", floor: "1st Floor", roomNumber: "Line 1 - Stitching Floor", description: "Single needle lockstitch and 4-thread overlock lines" },
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-SEW2", name: "Sewing Assembly Line 2", building: "Main Apparel Plant", floor: "1st Floor", roomNumber: "Line 2 - Sewing Assembly", description: "Heavy stitching, interlock, buttoning and collar attachment" },
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-FIN", name: "Finishing & Packaging Bay", building: "Main Apparel Plant", floor: "2nd Floor", roomNumber: "Finishing & Packaging Bay", description: "Steam pressing, stain removing, and final QA packaging" },
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-WHS", name: "Central Inventory Store", building: "Logistics Warehouse Annex", floor: "Ground Floor", roomNumber: "Central Inventory Store", description: "Raw textile rolls, spare parts, and completed asset storage" },
    { companyId: apparelsCompanyId, branchId: appBranchId, code: "LOC-APP-QAL", name: "Quality Assurance Lab", building: "Main Apparel Plant", floor: "Ground Floor", roomNumber: "Quality Assurance Lab", description: "Color fastness, tensile testing, and quality inspection station" },
    // Garments Locations (Noida Plant)
    { companyId: garmentsCompanyId, branchId: garBranchId, code: "LOC-GAR-FAB", name: "Weaving & Fabric Hall", building: "Noida Production Complex", floor: "Ground Floor", roomNumber: "Weaving & Fabric Hall", description: "Knitting, weaving, and primary raw fabric inspection" },
    { companyId: garmentsCompanyId, branchId: garBranchId, code: "LOC-GAR-ASY", name: "Assembly Line 1", building: "Noida Production Complex", floor: "1st Floor", roomNumber: "Assembly Line 1", description: "Garment assembly, collars, cuffs, and sleeve joining lines" },
    { companyId: garmentsCompanyId, branchId: garBranchId, code: "LOC-GAR-EMB", name: "Embroidery & Printing Bay", building: "Noida Production Complex", floor: "2nd Floor", roomNumber: "Embroidery & Printing Bay", description: "Computerized multi-head embroidery and screen printing" },
    { companyId: garmentsCompanyId, branchId: garBranchId, code: "LOC-GAR-DSP", name: "Export Dispatch Hub", building: "Export Logistics Warehouse", floor: "Ground Floor", roomNumber: "Dispatch Hub Bay 1", description: "Packaging, palletizing, and container dispatch loading bay" },
    { companyId: garmentsCompanyId, branchId: garBranchId, code: "LOC-GAR-MNT", name: "Engineering Workshop", building: "Engineering Block", floor: "Ground Floor", roomNumber: "Maintenance Workshop", description: "Preventive maintenance, motor rewinding, and pneumatic compressors" },
  ];

  for (const loc of locations) {
    await query(`
      INSERT INTO locations (company_id, branch_id, code, name, building, floor, room_number, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT DO NOTHING
    `, [loc.companyId, loc.branchId, loc.code, loc.name, loc.building, loc.floor, loc.roomNumber, loc.description]);
  }
  logger.info("Seeded physical plant locations for Apparels and Garments.");

  // 8. Seed Industrial Vendors
  const vendors = [
    // Apparels Vendors
    { companyId: apparelsCompanyId, code: "VEND-JUK", name: "Juki India Private Limited", contact: "Vikas Malhotra", email: "sales@jukiindia.com", phone: "+91-11-26814401", address: "Plot 298, Okhla Industrial Area Phase 3, New Delhi", tax: "07AAACJ1234F1Z5", rating: 4.8 },
    { companyId: apparelsCompanyId, code: "VEND-BRO", name: "Brother International India", contact: "Sunil Nair", email: "industrial@brother.in", phone: "+91-11-40506070", address: "Tower B, DLF Cyber City, Gurugram, Haryana", tax: "07AABCB9876K1ZQ", rating: 4.9 },
    { companyId: apparelsCompanyId, code: "VEND-LEC", name: "Lectra Technologies India", contact: "Arun Prasad", email: "contact@lectra.com", phone: "+91-11-41424344", address: "Logix Techno Park, Sector 127, Noida", tax: "07AABCL3322P1ZY", rating: 4.7 },
    { companyId: apparelsCompanyId, code: "VEND-SNG", name: "Singer Industrial Sewing Division", contact: "Deepak Chopra", email: "support@singerindia.net", phone: "+91-11-23271234", address: "A-26/4, Mohan Co-op Industrial Estate, Mathura Road, New Delhi", tax: "07AAACS5544R1ZM", rating: 4.5 },
    // Garments Vendors
    { companyId: garmentsCompanyId, code: "VEND-EAS", name: "Eastman Machine India Pvt Ltd", contact: "Ramesh Iyer", email: "sales@eastmanmachine.in", phone: "+91-120-4567890", address: "Plot 12, Sector 63, Noida, Uttar Pradesh", tax: "09AAACE9911D1ZX", rating: 4.8 },
    { companyId: garmentsCompanyId, code: "VEND-PEG", name: "Pegasus Sewing Machine India", contact: "Manoj Joshi", email: "service@pegasusindia.com", phone: "+91-120-4123456", address: "C-15, Hosiery Complex, Phase-2 Extn, Noida", tax: "09AABCP1122M1Z3", rating: 4.6 },
    { companyId: garmentsCompanyId, code: "VEND-TJM", name: "Tajima Embroidery Solutions", contact: "Karan Mehta", email: "info@tajimaindia.com", phone: "+91-120-4987654", address: "B-88, Sector 83, Phase 2, Noida", tax: "09AAACT7788H1Z8", rating: 4.9 },
    { companyId: garmentsCompanyId, code: "VEND-ATK", name: "Atlas Copco Compressors India", contact: "Naveen Saxena", email: "airpower@atlascopco.in", phone: "+91-120-4433221", address: "Industrial Area, Greater Noida, UP", tax: "09AAACA4433E1ZK", rating: 4.8 },
  ];

  for (const v of vendors) {
    await query(`
      INSERT INTO vendors (company_id, code, name, contact_person, email, phone, address, tax_number, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        contact_person = EXCLUDED.contact_person,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        tax_number = EXCLUDED.tax_number,
        rating = EXCLUDED.rating
    `, [v.companyId, v.code, v.name, v.contact, v.email, v.phone, v.address, v.tax, v.rating]);
  }
  logger.info("Seeded authorized industrial equipment vendors for both companies.");

  // 9. Seed Employees
  const appDepts = await query<{ id: string; code: string }>("SELECT id, code FROM departments WHERE company_id = $1", [apparelsCompanyId]);
  const garDepts = await query<{ id: string; code: string }>("SELECT id, code FROM departments WHERE company_id = $1", [garmentsCompanyId]);
  const appDeptMap = new Map(appDepts.rows.map((d) => [d.code, d.id]));
  const garDeptMap = new Map(garDepts.rows.map((d) => [d.code, d.id]));

  const employees = [
    // Apparels Employees
    { companyId: apparelsCompanyId, branchId: appBranchId, deptId: appDeptMap.get("DEPT-CUT"), code: "EMP-APP-001", first: "Rajesh", last: "Sharma", email: "rajesh.sharma@pantone-apparels.com", phone: "+91-9811100001", designation: "Master Cutting Specialist" },
    { companyId: apparelsCompanyId, branchId: appBranchId, deptId: appDeptMap.get("DEPT-SEW"), code: "EMP-APP-002", first: "Sunita", last: "Verma", email: "sunita.verma@pantone-apparels.com", phone: "+91-9811100002", designation: "Stitching Floor Supervisor" },
    { companyId: apparelsCompanyId, branchId: appBranchId, deptId: appDeptMap.get("DEPT-FIN"), code: "EMP-APP-003", first: "Amit", last: "Kumar", email: "amit.kumar@pantone-apparels.com", phone: "+91-9811100003", designation: "Finishing & QC Lead" },
    { companyId: apparelsCompanyId, branchId: appBranchId, deptId: appDeptMap.get("DEPT-SEW"), code: "EMP-APP-004", first: "Priya", last: "Patel", email: "priya.patel@pantone-apparels.com", phone: "+91-9811100004", designation: "Pattern & Sample Maker" },
    // Garments Employees
    { companyId: garmentsCompanyId, branchId: garBranchId, deptId: garDeptMap.get("DEPT-FAB"), code: "EMP-GAR-001", first: "Mohammed", last: "Farooq", email: "m.farooq@pantone-garments.com", phone: "+91-9812200001", designation: "Weaving & Fabric In-charge" },
    { companyId: garmentsCompanyId, branchId: garBranchId, deptId: garDeptMap.get("DEPT-ASY"), code: "EMP-GAR-002", first: "Anita", last: "Das", email: "anita.das@pantone-garments.com", phone: "+91-9812200002", designation: "Assembly Line Officer" },
    { companyId: garmentsCompanyId, branchId: garBranchId, deptId: garDeptMap.get("DEPT-LOG"), code: "EMP-GAR-003", first: "Vikram", last: "Singh", email: "vikram.singh@pantone-garments.com", phone: "+91-9812200003", designation: "Export Warehouse Officer" },
    { companyId: garmentsCompanyId, branchId: garBranchId, deptId: garDeptMap.get("DEPT-ASY"), code: "EMP-GAR-004", first: "Sanjay", last: "Rao", email: "sanjay.rao@pantone-garments.com", phone: "+91-9812200004", designation: "Plant Maintenance Engineer" },
  ];

  for (const emp of employees) {
    await query(`
      INSERT INTO employees (company_id, branch_id, department_id, employee_code, first_name, last_name, email, phone, designation, status, joined_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', CURRENT_DATE - INTERVAL '180 days')
      ON CONFLICT (company_id, employee_code) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        designation = EXCLUDED.designation,
        department_id = EXCLUDED.department_id
    `, [emp.companyId, emp.branchId, emp.deptId || null, emp.code, emp.first, emp.last, emp.email, emp.phone, emp.designation]);
  }
  logger.info("Seeded active employees for custody assignments and physical handovers.");

  // 10. Seed System Settings
  const systemSettings = [
    { key: "asset_tag_prefix", value: "AST", description: "Default prefix for generated asset tags" },
    { key: "depreciation_frequency", value: "MONTHLY", description: "Schedule frequency for straight-line amortization" },
    { key: "auto_generate_qr", value: "true", description: "Whether QR code is automatically generated on asset registration" },
    { key: "default_currency", value: "INR", description: "Base operating currency for asset valuation" },
    { key: "enable_mobile_scanning", value: "true", description: "Allow mobile device camera QR and barcode scanning" },
  ];

  for (const s of systemSettings) {
    await query(`
      INSERT INTO system_settings (company_id, setting_key, setting_value, description)
      VALUES (NULL, $1, $2, $3)
      ON CONFLICT (setting_key) WHERE company_id IS NULL DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description
    `, [s.key, s.value, s.description]);
  }
  logger.info("Seeded global enterprise system settings.");

  // 11. Seed Approval Workflows for Both Companies
  for (const compId of [apparelsCompanyId, garmentsCompanyId]) {
    const wfRes = await query<{ id: string }>(`
      INSERT INTO approval_workflows (company_id, name, request_type, description, is_active)
      VALUES ($1, 'Standard 2-Step Asset Acquisition Workflow', 'ASSET_REQUEST', 'Standard hierarchical request approval: Dept Manager followed by Company Admin', true)
      ON CONFLICT (company_id, request_type) WHERE is_active = true DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
      RETURNING id
    `, [compId]);

    const wfId = wfRes.rows[0].id;

    await query(`
      INSERT INTO approval_workflow_steps (workflow_id, step_order, role_code, description, is_active)
      VALUES 
        ($1, 1, 'DEPT_MANAGER', 'Departmental Technical Verification', true),
        ($1, 2, 'COMPANY_ADMIN', 'Executive Asset Authorization', true)
      ON CONFLICT (workflow_id, step_order) DO UPDATE SET
        role_code = EXCLUDED.role_code,
        description = EXCLUDED.description
    `, [wfId]);
  }
  logger.info("Seeded multi-step approval workflows for both enterprise companies.");

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