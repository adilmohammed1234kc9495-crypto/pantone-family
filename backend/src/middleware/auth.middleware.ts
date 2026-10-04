import { Request, Response, NextFunction } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../config/database";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  employeeId: string | null;
  departmentId: string | null;
  employeeCode: string | null;
  isCommonAdmin: boolean;
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  companyId: string | null;
  companyCode: string | null;
  roleCode: string;
  isCommonAdmin: boolean;
  permissions: string[];
  type: "access";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const tokenPayload: AccessTokenPayload = {
    ...payload,
    type: "access"
  };
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as unknown as number
  };
  return jwt.sign(tokenPayload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new UnauthorizedError("Invalid token type presented");
  }
  return decoded;
}

/**
 * Resolves effective permissions for a user:
 * effective permissions = role permissions + direct grants - direct denies
 */
export async function resolveEffectivePermissions(userId: string, roleId: string): Promise<string[]> {
  // 1. Role permissions
  const rolePermsRes = await query<{ code: string }>(`
    SELECT p.code
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = $1
  `, [roleId]);
  const perms = new Set<string>(rolePermsRes.rows.map((r) => r.code));

  // 2. Direct user overrides
  const userOverridesRes = await query<{ code: string; is_granted: boolean }>(`
    SELECT p.code, up.is_granted
    FROM permissions p
    JOIN user_permissions up ON p.id = up.permission_id
    WHERE up.user_id = $1
  `, [userId]);

  for (const row of userOverridesRes.rows) {
    if (row.is_granted) {
      perms.add(row.code); // Explicit grant
    } else {
      perms.delete(row.code); // Explicit deny
    }
  }

  return Array.from(perms).sort();
}

/**
 * Production Authentication Middleware
 * Validates Bearer token, checks user state in DB, and attaches authoritative context.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authentication token is required");
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError("Malformed authentication token");
    }

    const decoded = verifyAccessToken(token);

    // Query active state from database to ensure revocation / role updates take effect
    const userRes = await query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.is_active, 
        u.company_id, 
        u.employee_id,
        c.code as company_code, 
        c.name as company_name,
        c.is_active as company_active,
        r.id as role_id, 
        r.code as role_code,
        r.name as role_name,
        e.department_id,
        e.employee_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = $1
    `, [decoded.sub]);

    if (userRes.rows.length === 0) {
      throw new UnauthorizedError("User session no longer exists");
    }

    const row = userRes.rows[0];

    if (!row.is_active) {
      throw new ForbiddenError("User account has been deactivated");
    }

    if (row.company_id && row.company_active === false) {
      throw new ForbiddenError("Company account has been deactivated");
    }

    const isCommonAdmin = row.role_code === "COMMON_ADMIN" && row.company_id === null;

    // Resolve authoritative permissions
    const permissions = await resolveEffectivePermissions(row.id, row.role_id);

    req.user = {
      id: row.id,
      username: row.username,
      email: row.email,
      companyId: row.company_id,
      companyCode: row.company_code,
      companyName: row.company_name,
      roleId: row.role_id,
      roleCode: row.role_code,
      roleName: row.role_name,
      employeeId: row.employee_id,
      departmentId: row.department_id,
      employeeCode: row.employee_code,
      isCommonAdmin,
      permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}