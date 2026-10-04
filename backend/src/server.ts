import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { testConnection, pool } from "./config/database";

async function bootstrap() {
  const isDbReady = await testConnection();
  if (!isDbReady) {
    logger.error("FATAL: Could not connect to PostgreSQL. Halting startup.");
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`=======================================================`);
    logger.info(` PANTONE FIXED ASSET MANAGEMENT SYSTEM - API v1`);
    logger.info(` Mode:        ${env.NODE_ENV}`);
    logger.info(` Binding:     ${env.HOST}:${env.PORT}`);
    logger.info(` Prefix:      ${env.API_PREFIX}`);
    logger.info(` Database:    ${env.DB_NAME} on ${env.DB_HOST}:${env.DB_PORT}`);
    logger.info(` Health:      http://${env.HOST === "0.0.0.0" ? "localhost" : env.HOST}:${env.PORT}/health`);
    logger.info(`=======================================================`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info("HTTP server closed.");
      await pool.end();
      logger.info("PostgreSQL connection pool drained.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forceful shutdown after timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.error("Bootstrap failure", { error: err.message });
  process.exit(1);
});