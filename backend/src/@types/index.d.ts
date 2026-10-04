import { AuthUser } from "../middleware/auth.middleware";
import { TenantContext } from "../middleware/tenant.middleware";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenant?: TenantContext;
    }
  }
}