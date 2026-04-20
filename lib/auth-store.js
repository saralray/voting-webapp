import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { pool } from "@/lib/db";

const SESSION_COOKIE_NAME = "voting_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

const globalForAuth = globalThis;

function normalizeIdUser(iduser) {
  return String(iduser || "").trim().toUpperCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D+/g, "").slice(0, 10);
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || "").split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const incomingHash = scryptSync(password, salt, 64);
  const existingHash = Buffer.from(storedHash, "hex");

  if (incomingHash.length !== existingHash.length) {
    return false;
  }

  return timingSafeEqual(incomingHash, existingHash);
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function validatePasswordStrength(password) {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
}

async function ensureAuthSchema() {
  if (!globalForAuth.__votingAuthSchemaInit) {
    globalForAuth.__votingAuthSchemaInit = (async () => {
      await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS auth_user_iduser_seq START 1;

        CREATE TABLE IF NOT EXISTS auth_users (
          iduser TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          surname TEXT NOT NULL,
          nickname TEXT NOT NULL DEFAULT '',
          age INTEGER,
          grade_level TEXT NOT NULL DEFAULT '',
          school TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS auth_session_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES auth_users(iduser) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_login_attempts (
          identifier TEXT PRIMARY KEY,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          locked_until TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_auth_session_tokens_user_id ON auth_session_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_locked_until ON auth_login_attempts(locked_until);
        CREATE INDEX IF NOT EXISTS idx_auth_users_identity_lookup
          ON auth_users(LOWER(name), LOWER(surname), phone);
      `);

      await pool.query(
        `DELETE FROM auth_login_attempts
         WHERE identifier = 'ADMIN'`
      );

      await pool.query(
        `DELETE FROM auth_users
         WHERE iduser = 'ADMIN'
           AND name = 'Admin'
           AND surname = 'System'
           AND phone = ''`
      );
    })();
  }

  await globalForAuth.__votingAuthSchemaInit;
}

async function getLoginAttemptState(identifier) {
  const result = await pool.query(
    `SELECT failed_attempts, locked_until
     FROM auth_login_attempts
     WHERE identifier = $1
     LIMIT 1`,
    [identifier]
  );

  return result.rows[0] ?? null;
}

async function clearLoginAttempts(identifier) {
  await pool.query("DELETE FROM auth_login_attempts WHERE identifier = $1", [identifier]);
}

async function recordFailedLoginAttempt(identifier) {
  const existingAttempt = await getLoginAttemptState(identifier);
  const failedAttempts = (existingAttempt?.failed_attempts ?? 0) + 1;
  const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS).toISOString()
    : null;

  await pool.query(
    `INSERT INTO auth_login_attempts (identifier, failed_attempts, locked_until, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (identifier)
     DO UPDATE SET
       failed_attempts = EXCLUDED.failed_attempts,
       locked_until = EXCLUDED.locked_until,
       updated_at = NOW()`,
    [identifier, failedAttempts, lockedUntil]
  );

  if (!lockedUntil) {
    return null;
  }

  return Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000);
}

export async function createAuthUser(input) {
  await ensureAuthSchema();
  const passwordHash = hashPassword(input.password);
  const result = await pool.query(
    `INSERT INTO auth_users (iduser, name, surname, nickname, age, grade_level, school, phone, password_hash)
     VALUES (
       'GL' || LPAD(nextval('auth_user_iduser_seq')::text, 4, '0'),
       $1, $2, $3, $4, $5, $6, $7, $8
     )
     RETURNING iduser, name, surname, nickname, age, grade_level, school, phone, created_at`,
    [
      normalizeName(input.name),
      normalizeName(input.surname),
      normalizeName(input.nickname),
      input.age,
      String(input.gradeLevel || "").trim(),
      normalizeName(input.school),
      normalizePhone(input.phone),
      passwordHash
    ]
  );

  return result.rows[0];
}

export async function authenticateAuthUser(iduser, password) {
  await ensureAuthSchema();
  const normalizedIdUser = normalizeIdUser(iduser);
  const loginAttempt = await getLoginAttemptState(normalizedIdUser);

  if (loginAttempt?.locked_until) {
    const retryAfterMs = new Date(loginAttempt.locked_until).getTime() - Date.now();
    if (retryAfterMs > 0) {
      return {
        status: "locked",
        retryAfterMinutes: Math.ceil(retryAfterMs / 60000)
      };
    }

    await clearLoginAttempts(normalizedIdUser);
  }

  const result = await pool.query(
    `SELECT iduser, name, surname, nickname, age, grade_level, school, phone, password_hash, created_at
     FROM auth_users
     WHERE iduser = $1
     LIMIT 1`,
    [normalizedIdUser]
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    const retryAfterMinutes = await recordFailedLoginAttempt(normalizedIdUser);
    if (retryAfterMinutes) {
      return { status: "locked", retryAfterMinutes };
    }

    return { status: "invalid" };
  }

  await clearLoginAttempts(normalizedIdUser);
  return { status: "success", user };
}

export async function createSession(userId) {
  await ensureAuthSchema();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await pool.query("DELETE FROM auth_session_tokens WHERE user_id = $1", [userId]);
  await pool.query(
    `INSERT INTO auth_session_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [hashSessionToken(token), userId, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteSession(token) {
  await ensureAuthSchema();
  await pool.query(
    "DELETE FROM auth_session_tokens WHERE token_hash = $1",
    [hashSessionToken(token)]
  );
}

export async function getUserBySessionToken(token) {
  await ensureAuthSchema();
  await pool.query("DELETE FROM auth_session_tokens WHERE expires_at <= NOW()");

  const result = await pool.query(
    `SELECT u.iduser, u.name, u.surname, u.nickname, u.age, u.grade_level, u.school, u.phone, u.created_at
     FROM auth_session_tokens s
     JOIN auth_users u ON u.iduser = s.user_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [hashSessionToken(token)]
  );

  return result.rows[0] ?? null;
}

export async function findUserIdsByIdentity(input) {
  await ensureAuthSchema();
  const result = await pool.query(
    `SELECT iduser, name, surname, created_at
     FROM auth_users
     WHERE LOWER(name) = LOWER($1)
       AND LOWER(surname) = LOWER($2)
       AND phone = $3
     ORDER BY created_at ASC`,
    [
      normalizeName(input.name),
      normalizeName(input.surname),
      normalizePhone(input.phone)
    ]
  );

  return result.rows;
}

export async function resetPasswordByIdentity(input) {
  await ensureAuthSchema();
  const normalizedIdUser = normalizeIdUser(input.iduser);
  const phone = normalizePhone(input.phone);
  const passwordHash = hashPassword(input.newPassword);

  const result = await pool.query(
    `UPDATE auth_users
     SET password_hash = $3
     WHERE iduser = $1
       AND phone = $2
     RETURNING iduser`,
    [normalizedIdUser, phone, passwordHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  await pool.query("DELETE FROM auth_session_tokens WHERE user_id = $1", [normalizedIdUser]);
  await clearLoginAttempts(normalizedIdUser);
  return result.rows[0];
}

export { SESSION_COOKIE_NAME };
