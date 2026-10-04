import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext, assertCompanyAccess } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { query } from "../../config/database";
import { sendSuccess } from "../../utils/response";
import { NotFoundError } from "../../utils/errors";

export const employeesRouter = Router();

employeesRouter.use(authenticate, resolveTenantContext);

employeesRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, { module: "employees", tenant: req.tenant, status: "healthy" });
});

employeesRouter.get("/", requirePermission("employees:view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = !req.user!.isCommonAdmin 
      ? req.user!.companyId! 
      : ((req.query.companyId as string) || (req.tenant?.companyId || null));

    let sql = "SELECT * FROM employees";
    const params: unknown[] = [];
    if (companyId) {
      sql += " WHERE company_id = $1";
      params.push(companyId);
    }
    sql += " ORDER BY first_name ASC, last_name ASC";

    const resDb = await query(sql, params);
    sendSuccess(res, resDb.rows, "Employees retrieved successfully");
  } catch (error) {
    next(error);
  }
});

employeesRouter.get("/:id", requirePermission("employees:view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resDb = await query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    if (resDb.rows.length === 0) {
      throw new NotFoundError(`Employee '${req.params.id}' not found`);
    }

    const employee = resDb.rows[0];
    assertCompanyAccess(req.user!, employee.company_id, req);

    sendSuccess(res, employee, "Employee retrieved successfully");
  } catch (error) {
    next(error);
  }
});