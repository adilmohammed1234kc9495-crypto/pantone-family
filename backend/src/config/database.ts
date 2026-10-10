import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";
import { logger } from "./logger";

function shouldEnableSsl(): boolean {
  if (env.DB_SSL) return true;
  if (env.DATABASE_URL) {
    if (env.DATABASE_URL.includes("sslmode=require") || env.DATABASE_URL.includes("ssl=true")) {
      return true;
    }
    if (env.NODE_ENV === "production" && !env.DATABASE_URL.includes("localhost") && !env.DATABASE_URL.includes("127.0.0.1")) {
      return true;
    }
  }
  return false;
}

function createPool(): Pool {
  if (!env.DATABASE_URL && env.NODE_ENV === "production") {
    logger.warn("DATABASE_URL is not set in environment variables! Defaulting to local database host 127.0.0.1:5433. In cloud production (Render), configure DATABASE_URL in your service dashboard settings.");
  }

  const useSsl = shouldEnableSsl();

  const p = new Pool({
    connectionString: env.DATABASE_URL || undefined,
    host: env.DATABASE_URL ? undefined : env.DB_HOST,
    port: env.DATABASE_URL ? undefined : env.DB_PORT,
    user: env.DATABASE_URL ? undefined : env.DB_USER,
    password: env.DATABASE_URL ? undefined : env.DB_PASSWORD,
    database: env.DATABASE_URL ? undefined : env.DB_NAME,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  p.on("error", (err) => {
    logger.error("Unexpected error on idle PostgreSQL client", { error: err.message });
  });

  return p;
}

export let pool = createPool();

export function getPool(): Pool {
  if (pool.ended) {
    pool = createPool();
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await getPool().query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn("Slow query detected", { text, duration, rows: res.rowCount });
  }
  return res;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const res = await query("SELECT NOW() as current_time, current_database() as db_name");
    logger.info("Connected to PostgreSQL successfully", {
      database: res.rows[0].db_name,
      currentTime: res.rows[0].current_time
    });
    return true;
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL", { error });
    return false;
  }
}