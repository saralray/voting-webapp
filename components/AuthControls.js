import { logout } from "@/app/actions";

export function SignInButton() {
  return (
    <a className="auth-button" href="/login">
      Sign in
    </a>
  );
}

export function AuthControls({ session }) {
  if (!session?.user) {
    return (
      <a className="auth-inline" href="/login">
        Sign in
      </a>
    );
  }

  return (
    <form action={logout}>
      <button className="auth-inline" type="submit">
        Sign out
      </button>
    </form>
  );
}
