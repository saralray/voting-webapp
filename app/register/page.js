import { register } from "@/app/actions";

const statusMap = {
  "missing-fields": "Fill in the required fields.",
  "register-error": "Could not create account.",
  "password-error": null
};

export default function RegisterPage({ searchParams }) {
  const status =
    searchParams?.status === "password-error"
      ? searchParams?.message
      : statusMap[searchParams?.status] || null;

  return (
    <section className="centered">
      <div className="card card--login">
        <p className="eyebrow">Register</p>
        <h1>Create account</h1>
        <p className="lede">A new iduser will be generated automatically.</p>
        {status ? <p className="notice notice--danger">{status}</p> : null}

        <form action={register} className="stack">
          <input className="input" name="name" placeholder="Name" type="text" />
          <input className="input" name="phone" placeholder="Phone" type="text" />
          <input className="input" name="password" placeholder="Password" type="password" />
          <button className="button" type="submit">
            Register
          </button>
        </form>

        <div className="auth-links">
          <a href="/login">Back to login</a>
        </div>
      </div>
    </section>
  );
}
