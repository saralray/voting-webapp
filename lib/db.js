import { Pool } from "pg";

const globalForDb = globalThis;

export const pool =
  globalForDb.__votingPool ??
  new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__votingPool = pool;
}

export async function sql(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
