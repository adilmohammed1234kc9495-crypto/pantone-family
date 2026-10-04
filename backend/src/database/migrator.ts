import fs from "fs";
import path from "path";
import { pool } from "../config/database";
import { logger } from "../config/logger";

export async function runMigrations(reset = false): Promise<void> {
  const client = await pool.connect();
  try {
    if (reset) {
      logger.warn("RESETTING DATABASE SCHEMA (DROP ALL TABLES)...");
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      logger.info("Public schema recreated.");
    }

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

    const appliedRes = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const appliedSet = new Set(appliedRes.rows.map((r) => r.filename));

    for (const file of files) {
      if (!appliedSet.has(file)) {
        logger.info(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
          await client.query("COMMIT");
          logger.info(`Migration applied successfully: ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          logger.error(`Migration failed: ${file}`, { error: (err as Error).message });
          throw err;
        }
      } else {
        logger.debug(`Migration already applied: ${file}`);
      }
    }
    logger.info("All database migrations are up to date.");
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const isReset = process.argv.includes("--reset");
  runMigrations(isReset)
    .then(() => {
      logger.info("Migration runner completed.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error("Migration failed", { error: err.message });
      process.exit(1);
    });
}