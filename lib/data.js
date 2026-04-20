import { sql } from "@/lib/db";

const globalForData = globalThis;

async function ensureAppSettingsSchema() {
  if (!globalForData.__votingAppSettingsSchemaInit) {
    globalForData.__votingAppSettingsSchemaInit = (async () => {
      await sql(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await sql(
        `INSERT INTO app_settings (key, value)
         VALUES ('voting_enabled', 'true')
         ON CONFLICT (key) DO NOTHING`
      );
    })();
  }

  await globalForData.__votingAppSettingsSchemaInit;
}

export async function getCandidates() {
  const result = await sql(
    "SELECT id, name FROM candidates ORDER BY id"
  );

  return result.rows;
}

export async function getResults() {
  const result = await sql(
    `SELECT candidates.id, candidates.name, COUNT(votes.id)::int AS votes
     FROM candidates
     LEFT JOIN votes ON candidates.id = votes.candidate_id
     GROUP BY candidates.id, candidates.name
     ORDER BY candidates.name`
  );

  return result.rows;
}

export async function getVotesForExport() {
  const result = await sql(
    `SELECT users.name AS voter_iduser, candidates.name AS candidate_name
     FROM votes
     JOIN users ON votes.user_id = users.id
     JOIN candidates ON votes.candidate_id = candidates.id
     ORDER BY users.name`
  );

  return result.rows;
}

export async function getVotingSettings() {
  await ensureAppSettingsSchema();
  const result = await sql(
    `SELECT value
     FROM app_settings
     WHERE key = 'voting_enabled'
     LIMIT 1`
  );

  return {
    votingEnabled: result.rows[0]?.value !== "false"
  };
}

export async function setVotingEnabled(enabled) {
  await ensureAppSettingsSchema();
  await sql(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('voting_enabled', $1, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [enabled ? "true" : "false"]
  );
}

export async function isAdmin(iduser) {
  const normalizedIdUser = String(iduser || "").trim().toUpperCase();
  const adminIdUsers = (process.env.ADMIN_IDUSERS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (adminIdUsers.includes(normalizedIdUser)) {
    return true;
  }

  return false;
}

export async function getDashboardSummary() {
  const result = await sql(
    `SELECT
       (SELECT COUNT(*)::int FROM users) AS voters,
       (SELECT COUNT(*)::int FROM votes) AS votes,
       (SELECT COUNT(*)::int FROM candidates) AS candidates`
  );

  return result.rows[0];
}
