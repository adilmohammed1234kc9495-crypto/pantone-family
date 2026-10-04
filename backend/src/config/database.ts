import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";
import { logger } from "./logger";

function createPool(): Pool {
  const p = new Pool({
    connectionString: env.DATABASE_URL || undefined,
    host: env.DATABASE_URL ? undefined : env.DB_HOST,
    port: env.DATABASE_URL ? undefined : env.DB_PORT,
    user: env.DATABASE_URL ? undefined : env.DB_USER,
    password: env.DATABASE_URL ? undefined : env.DB_PASSWORD,
    database: env.DATABASE_URL ? undefined : env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
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