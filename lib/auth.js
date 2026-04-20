import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession, getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const user = await getUserBySessionToken(token);
  if (!user) {
    return null;
  }

  return { user };
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await deleteSession(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
