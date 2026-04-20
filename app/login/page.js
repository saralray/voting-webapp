import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { getSession } from "@/lib/auth";

const statusMap = {
  invalid: "Invalid iduser or password.",
  registered: "Registration complete. Use your new iduser to sign in.",
  locked: "Too many failed attempts. Please wait and try again."
};

export default async function LoginPage({ searchParams }) {
  const session = await getSession();

  if (session?.user) {
    redirect("/");
  }

  const status = statusMap[searchParams?.status] || null;
  const generatedIduser = searchParams?.iduser || null;
  const minutes = searchParams?.minutes || null;

  return (
    <section className="centered">
      <div className="card card--login">
        <p className="eyebrow">Login</p>
        <h1>Sign in</h1>
        <p className="lede">Use your iduser and password.</p>

        {status ? (
          <p className="notice">
            {status}
            {minutes ? ` Retry in about ${minutes} minutes.` : ""}
            {generatedIduser ? ` Your iduser is ${generatedIduser}.` : ""}
          </p>
        ) : null}

        <form action={login} className="stack">
          <input className="input" name="iduser" placeholder="ID User" type="text" />
          <input className="input" name="password" placeholder="Password" type="password" />
          <button className="button" type="submit">
            Sign in
          </button>
        </form>

        <div className="auth-links">
          <a href="/register">Create account</a>
        </div>
      </div>
    </section>
  );
}
