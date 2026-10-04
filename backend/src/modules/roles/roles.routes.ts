import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { query } from "../../config/database";
import { sendSuccess } from "../../utils/response";

export const rolesRouter = Router();

rolesRouter.use(authenticate, resolveTenantContext);

rolesRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "roles",
    tenant: req.tenant,
    status: "healthy"
  }, "Module roles initialized and tenant-scoped");
});

rolesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let sql: string;
    let params: unknown[] = [];

    if (user.isCommonAdmin) {
      if (req.query.companyId) {
        sql = `
          SELECT * FROM roles 
          WHERE company_id = $1 OR company_id IS NULL 
          ORDER BY is_system_role DESC, name ASC
        `;
        params = [req.query.companyId];
      } else {
        sql = `SELECT * FROM roles ORDER BY is_system_role DESC, name ASC`;
      }
    } else {
      sql = `
        SELECT * FROM roles 
        WHERE company_id = $1 OR company_id IS NULL 
        ORDER BY is_system_role DESC, name ASC
      `;
      params = [user.companyId];
    }

    const result = await query(sql, params);
    sendSuccess(res, result.rows, "Roles retrieved successfully");
  } catch (error) {
    next(error);
  }
});