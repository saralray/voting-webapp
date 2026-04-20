import { Space_Grotesk, Bitter } from "next/font/google";
import { getSession } from "@/lib/auth";
import { AuthControls } from "@/components/AuthControls";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = Bitter({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: "Pulse Vote",
  description: "Next.js voting platform with local login and PostgreSQL."
};

export default async function RootLayout({ children }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="shell">
          <header className="topbar">
            <a className="brand" href="/">
              Pulse Vote
            </a>
            <nav className="topbar__nav">
              <a href="/">Vote</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/admin">Admin</a>
              {session?.user ? (
                <span className="auth-iduser">{session.user.iduser}</span>
              ) : null}
              <AuthControls session={session} />
            </nav>
          </header>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
