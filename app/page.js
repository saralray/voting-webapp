import { submitVote } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { getCandidates, getVotingSettings } from "@/lib/data";
import { SignInButton } from "@/components/AuthControls";

const statusMap = {
  voted: "Vote submitted.",
  "already-voted": "This account already voted.",
  "invalid-vote": "Select a candidate before submitting.",
  "vote-error": "Vote submission failed. Please try again.",
  "voting-closed": "Voting is currently closed."
};

export default async function HomePage({ searchParams }) {
  const session = await getSession();
  const status = statusMap[searchParams?.status] || null;

  let candidates = [];
  let isDatabaseReady = true;
  let votingEnabled = true;

  try {
    candidates = await getCandidates();
    const settings = await getVotingSettings();
    votingEnabled = settings.votingEnabled;
  } catch (error) {
    isDatabaseReady = false;
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Voting</div>
        <h1>Online Voting</h1>
        <p className="lede">Login, vote once, and view live results.</p>
        <div className="hero__actions">
          <a className="button button--ghost" href="/dashboard">
            Dashboard
          </a>
          <a className="button button--ghost" href="/admin">
            Admin
          </a>
        </div>
      </section>

      {status ? <p className="notice">{status}</p> : null}
      {!isDatabaseReady ? (
        <p className="notice notice--danger">
          Database connection is unavailable. Check your environment variables
          and PostgreSQL network access.
        </p>
      ) : null}

      <section className="grid">
        <article className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Voting</p>
              <h2>Cast exactly one vote</h2>
            </div>
            {session?.user ? (
              <p className="muted">{session.user.iduser}</p>
            ) : (
              <p className="muted">Login required</p>
            )}
          </div>

          {session?.user ? (
            !votingEnabled ? (
              <p className="muted">Voting is currently closed by an admin.</p>
            ) : candidates.length > 0 ? (
              <form className="stack" action={submitVote}>
                <div className="candidate-list">
                  {candidates.map((candidate) => (
                    <label className="candidate-option" key={candidate.id}>
                      <input
                        defaultChecked={false}
                        name="candidateId"
                        type="radio"
                        value={candidate.id}
                      />
                      <span>{candidate.name}</span>
                    </label>
                  ))}
                </div>
                <button className="button" type="submit">
                  Submit vote
                </button>
              </form>
            ) : (
              <p className="muted">
                No candidates yet. Add them from the admin panel.
              </p>
            )
          ) : (
            <div className="stack">
              <p className="muted">
                Sign in to unlock the ballot and prevent duplicate voting by iduser.
              </p>
              <SignInButton />
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
