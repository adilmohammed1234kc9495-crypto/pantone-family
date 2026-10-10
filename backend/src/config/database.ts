import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";
import { logger } from "./logger";

export interface ParsedDatabaseConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

export function parseDatabaseUrl(raw?: string): ParsedDatabaseConfig | null {
  if (!raw) return null;
  let str = raw.trim();

  // Strip enclosing quotes if user pasted with quotes
  while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Strip 'psql ' prefix if user copied from terminal
  if (str.startsWith("psql ")) {
    str = str.replace(/^psql\s+/, "").trim();
  }

  // Remove scheme
  let withoutScheme = str;
  if (withoutScheme.startsWith("postgresql://")) {
    withoutScheme = withoutScheme.slice("postgresql://".length);
  } else if (withoutScheme.startsWith("postgres://")) {
    withoutScheme = withoutScheme.slice("postgres://".length);
  }

  let user: string | undefined;
  let password: string | undefined;
  let rest = withoutScheme;

  const atIndex = withoutScheme.lastIndexOf("@");
  if (atIndex !== -1) {
    const userInfo = withoutScheme.slice(0, atIndex);
    rest = withoutScheme.slice(atIndex + 1);

    const colonIndex = userInfo.indexOf(":");
    if (colonIndex !== -1) {
      user = userInfo.slice(0, colonIndex);
      password = userInfo.slice(colonIndex + 1);
    } else {
      user = userInfo;
    }
  }

  // Split query params if any
  let query = "";
  const queryIndex = rest.indexOf("?");
  if (queryIndex !== -1) {
    query = rest.slice(queryIndex + 1);
    rest = rest.slice(0, queryIndex);
  }

  // Split path (database name)
  let database: string | undefined;
  const slashIndex = rest.indexOf("/");
  if (slashIndex !== -1) {
    database = rest.slice(slashIndex + 1);
    rest = rest.slice(0, slashIndex);
  }

  // Split host and port
  let host = rest;
  let port: number | undefined;
  const portColonIndex = rest.lastIndexOf(":");
  if (portColonIndex !== -1) {
    const potentialPort = rest.slice(portColonIndex + 1);
    if (/^\d+$/.test(potentialPort)) {
      port = parseInt(potentialPort, 10);
      host = rest.slice(0, portColonIndex);
    }
  }

  const hasSslQuery =
    query.includes("sslmode=require") ||
    query.includes("ssl=true") ||
    query.includes("sslmode=no-verify");

  return {
    user: user ? decodeURIComponent(user) : undefined,
    password: password ? decodeURIComponent(password) : undefined,
    host: host ? decodeURIComponent(host) : undefined,
    port: port || undefined,
    database: database ? decodeURIComponent(database) : undefined,
    ssl: hasSslQuery || undefined,
  };
}

function createPool(): Pool {
  if (!env.DATABASE_URL && env.NODE_ENV === "production") {
    logger.warn("DATABASE_URL is not set in environment variables! Defaulting to local database host 127.0.0.1:5433. In cloud production (Render), configure DATABASE_URL in your service dashboard settings.");
  }

  const parsed = parseDatabaseUrl(env.DATABASE_URL);

  const host = parsed?.host || env.DB_HOST;
  const port = parsed?.port || env.DB_PORT;
  const user = parsed?.user || env.DB_USER;
  const password = parsed?.password !== undefined ? parsed.password : env.DB_PASSWORD;
  const database = parsed?.database || env.DB_NAME;

  // Determine SSL
  let useSsl = env.DB_SSL;
  if (!useSsl && parsed?.ssl) {
    useSsl = true;
  }
  if (!useSsl && env.NODE_ENV === "production" && host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    useSsl = true;
  }

  logger.info("Initializing PostgreSQL pool", {
    host,
    port,
    database,
    user,
    ssl: useSsl
  });

  const p = new Pool({
    host,
    port,
    user,
    password,
    database,
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