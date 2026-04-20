"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearCurrentSession, requireSession } from "@/lib/auth";
import {
  authenticateAuthUser,
  createAuthUser,
  createSession,
  findUserIdsByIdentity,
  resetPasswordByIdentity,
  SESSION_COOKIE_NAME,
  validatePasswordStrength
} from "@/lib/auth-store";
import { getVotingSettings, isAdmin, setVotingEnabled } from "@/lib/data";
import { withTransaction } from "@/lib/db";

async function requireAdminUser() {
  const session = await requireSession();
  const iduser = session.user.iduser;

  if (!(await isAdmin(iduser))) {
    redirect("/admin?status=forbidden");
  }

  return session.user;
}

export async function submitVote(formData) {
  const session = await requireSession();
  const candidateId = Number(formData.get("candidateId"));
  const iduser = session.user.iduser;
  const settings = await getVotingSettings();

  if (!settings.votingEnabled) {
    redirect("/?status=voting-closed");
  }

  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    redirect("/?status=invalid-vote");
  }

  try {
    const result = await withTransaction(async (client) => {
      const existingUser = await client.query(
        "SELECT id FROM users WHERE name = $1 LIMIT 1",
        [iduser]
      );

      if (existingUser.rowCount > 0) {
        return "already-voted";
      }

      const insertedUser = await client.query(
        "INSERT INTO users (name) VALUES ($1) RETURNING id",
        [iduser]
      );

      await client.query(
        "INSERT INTO votes (user_id, candidate_id) VALUES ($1, $2)",
        [insertedUser.rows[0].id, candidateId]
      );

      return "voted";
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    redirect(result === "already-voted" ? "/?status=already-voted" : "/?status=voted");
  } catch (error) {
    redirect("/?status=vote-error");
  }
}

export async function addCandidate(formData) {
  await requireAdminUser();

  const name = String(formData.get("name") || "").trim();

  if (!name) {
    redirect("/admin?status=empty-name");
  }

  try {
    await withTransaction(async (client) => {
      await client.query("INSERT INTO candidates (name) VALUES ($1)", [name]);
    });
  } catch (error) {
    redirect("/admin?status=save-error");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?status=candidate-added");
}

export async function deleteCandidate(formData) {
  await requireAdminUser();

  const candidateId = Number(formData.get("candidateId"));

  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    redirect("/admin?status=invalid-candidate");
  }

  try {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM candidates WHERE id = $1", [candidateId]);
    });
  } catch (error) {
    redirect("/admin?status=delete-error");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?status=candidate-deleted");
}

export async function resetVotes() {
  await requireAdminUser();

  try {
    await withTransaction(async (client) => {
      await client.query("TRUNCATE votes, users RESTART IDENTITY CASCADE");
    });
  } catch (error) {
    redirect("/admin?status=reset-error");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?status=votes-reset");
}

export async function updateVotingStatus(formData) {
  await requireAdminUser();

  const enabled = String(formData.get("enabled") || "") === "true";

  try {
    await setVotingEnabled(enabled);
  } catch (error) {
    redirect("/admin?status=voting-status-error");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect(`/admin?status=${enabled ? "voting-opened" : "voting-closed"}`);
}

export async function login(formData) {
  const iduser = String(formData.get("iduser") || "");
  const password = String(formData.get("password") || "");
  const result = await authenticateAuthUser(iduser, password);

  if (result.status === "locked") {
    redirect(`/login?status=locked&minutes=${result.retryAfterMinutes}`);
  }

  if (result.status === "invalid") {
    redirect("/login?status=invalid");
  }

  const session = await createSession(result.user.iduser);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: new Date(session.expiresAt),
    path: "/"
  });

  redirect("/");
}

export async function logout() {
  await clearCurrentSession();
  redirect("/login");
}

export async function register(formData) {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    redirect(`/register?status=password-error&message=${encodeURIComponent(passwordError)}`);
  }

  if (!name || !phone) {
    redirect("/register?status=missing-fields");
  }

  try {
    const user = await createAuthUser({
      name,
      surname: name,
      nickname: name,
      age: null,
      gradeLevel: "",
      school: "",
      phone,
      password
    });

    redirect(`/login?status=registered&iduser=${user.iduser}`);
  } catch (error) {
    redirect("/register?status=register-error");
  }
}
