import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { requestLogger } from "./middleware/logging.middleware";
import { errorHandler } from "./middleware/error.middleware";
import { sendSuccess } from "./utils/response";
import { NotFoundError } from "./utils/errors";
import { testConnection } from "./config/database";
import { authRateLimiter, apiRateLimiter } from "./middleware/rate-limit.middleware";

// Route imports
import { authRouter } from "./modules/auth/auth.routes";
import { companiesRouter } from "./modules/companies/companies.routes";
import { usersRouter } from "./modules/users/users.routes";
import { rolesRouter } from "./modules/roles/roles.routes";
import { employeesRouter } from "./modules/employees/employees.routes";
import { branchesRouter } from "./modules/branches/branches.routes";
import { departmentsRouter } from "./modules/departments/departments.routes";
import { locationsRouter } from "./modules/locations/locations.routes";
import { vendorsRouter } from "./modules/vendors/vendors.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { assetsRouter } from "./modules/assets/assets.routes";
import { stockRouter } from "./modules/stock/stock.routes";
import { requestsRouter } from "./modules/requests/requests.routes";
import { assignmentsRouter } from "./modules/assignments/assignments.routes";
import { returnsRouter } from "./modules/returns/returns.routes";
import { damageInspectionsRouter } from "./modules/damage-inspections/damage-inspections.routes";
import { transfersRouter } from "./modules/transfers/transfers.routes";
import { handoversRouter } from "./modules/handovers/handovers.routes";
import { maintenanceRouter } from "./modules/maintenance/maintenance.routes";
import { qrRouter } from "./modules/qr/qr.routes";
import { scanRouter, scansListRouter } from "./modules/scan/scan.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { approvalsRouter } from "./modules/approvals/approvals.routes";
import { approvalWorkflowsRouter } from "./modules/approval-workflows/approval-workflows.routes";

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // Production Security Headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      }
    } : false,
    crossOriginEmbedderPolicy: false,
    hsts: env.NODE_ENV === "production" ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  }));

  // Environment-aware CORS configuration
  const allowedOrigins = env.CORS_ORIGIN.split(",").map(o => o.trim());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (env.NODE_ENV === "development" && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Company-Id", "X-Request-Id"]
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(requestLogger);

  // System Health & Readiness probes
  const handleLiveness = (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: "UP",
      service: "Pantone Fixed Asset Management System API",
      environment: env.NODE_ENV,
      version: "1.0.0"
    }, "System is operational");
  };

  const handleReadiness = async (_req: Request, res: Response) => {
    const isDbConnected = await testConnection();
    if (!isDbConnected) {
      return res.status(503).json({
        success: false,
        status: "DEGRADED",
        message: "Database connection unavailable",
        timestamp: new Date().toISOString()
      });
    }
    sendSuccess(res, {
      status: "UP",
      database: "CONNECTED",
      service: "Pantone Fixed Asset Management System API",
      version: "1.0.0"
    }, "Service is ready to handle traffic");
  };

  // Root endpoint for platform health probes (Render default HEAD / and GET / check)
  app.all("/", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "UP",
      service: "Pantone Fixed Asset Management System API",
      environment: env.NODE_ENV,
      version: "1.0.0"
    });
  });

  app.get("/health", handleLiveness);
  app.get("/health/live", handleLiveness);
  app.get("/health/ready", handleReadiness);

  // API Version 1 Router
  const apiV1 = express.Router();

  apiV1.use(apiRateLimiter);

  apiV1.get("/health", handleLiveness);
  apiV1.get("/health/live", handleLiveness);
  apiV1.get("/health/ready", handleReadiness);

  apiV1.use("/auth", authRateLimiter, authRouter);
  apiV1.use("/companies", companiesRouter);
  apiV1.use("/users", usersRouter);
  apiV1.use("/roles", rolesRouter);
  apiV1.use("/employees", employeesRouter);
  apiV1.use("/branches", branchesRouter);
  apiV1.use("/departments", departmentsRouter);
  apiV1.use("/locations", locationsRouter);
  apiV1.use("/vendors", vendorsRouter);
  apiV1.use("/categories", categoriesRouter);
  apiV1.use("/asset-categories", categoriesRouter);
  apiV1.use("/assets", assetsRouter);
  apiV1.use("/stock", stockRouter);
  apiV1.use("/requests", requestsRouter);
  apiV1.use("/assignments", assignmentsRouter);
  apiV1.use("/returns", returnsRouter);
  apiV1.use("/damage-inspections", damageInspectionsRouter);
  apiV1.use("/transfers", transfersRouter);
  apiV1.use("/handovers", handoversRouter);
  apiV1.use("/maintenance", maintenanceRouter);
  apiV1.use("/qr", qrRouter);
  apiV1.use("/scan", scanRouter);
  apiV1.use("/scans", scansListRouter);
  apiV1.use("/reports", reportsRouter);
  apiV1.use("/audit", auditRouter);
  apiV1.use("/notifications", notificationsRouter);
  apiV1.use("/dashboard", dashboardRouter);
  apiV1.use("/approvals", approvalsRouter);
  apiV1.use("/approval-workflows", approvalWorkflowsRouter);

  app.use(env.API_PREFIX, apiV1);

  // 404 Handler for unrecognized endpoints
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}