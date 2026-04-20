import { addCandidate, deleteCandidate, resetVotes, updateVotingStatus } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { getCandidates, getVotingSettings, isAdmin } from "@/lib/data";

const statusMap = {
  "candidate-added": "Candidate added.",
  "candidate-deleted": "Candidate deleted.",
  "votes-reset": "Votes were reset.",
  "voting-opened": "Voting is now open.",
  "voting-closed": "Voting is now closed.",
  forbidden: "This account is not allowed to access the admin panel.",
  "empty-name": "Candidate name is required.",
  "invalid-candidate": "Invalid candidate selection.",
  "save-error": "Failed to save the candidate.",
  "delete-error": "Failed to delete the candidate.",
  "reset-error": "Failed to reset votes.",
  "voting-status-error": "Failed to update voting status."
};

export default async function AdminPage({ searchParams }) {
  const session = await getSession();
  const iduser = session?.user?.iduser;
  const status = statusMap[searchParams?.status] || null;

  if (!iduser) {
    return (
      <section className="centered">
        <div className="card card--login">
          <p className="eyebrow">Admin</p>
          <h1>Login required</h1>
          <p className="lede">Sign in first, then open the admin panel again.</p>
          <a className="button" href="/login">
            Go to login
          </a>
        </div>
      </section>
    );
  }

  const admin = await isAdmin(iduser).catch(() => false);

  if (!admin) {
    return (
      <section className="centered">
        <div className="card card--login">
          <p className="eyebrow">Admin</p>
          <h1>Access denied</h1>
          <p className="lede">
            The signed-in iduser is not configured in <code>ADMIN_IDUSERS</code>.
          </p>
        </div>
      </section>
    );
  }

  const [candidates, settings] = await Promise.all([
    getCandidates().catch(() => []),
    getVotingSettings().catch(() => ({ votingEnabled: true }))
  ]);

  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">Admin Panel</p>
        <h1>Manage Candidates</h1>
        <p className="lede">Add candidates, remove candidates, control voting, and reset votes.</p>
      </section>

      {status ? <p className="notice">{status}</p> : null}

      <section className="grid">
        <article className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Candidate Setup</p>
              <h2>Add a new option</h2>
            </div>
          </div>
          <form action={addCandidate} className="inline-form">
            <input
              className="input"
              name="name"
              placeholder="Candidate name"
              type="text"
            />
            <button className="button" type="submit">
              Add candidate
            </button>
          </form>
        </article>

        <article className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Voting Status</p>
              <h2>{settings.votingEnabled ? "Voting is open" : "Voting is closed"}</h2>
            </div>
          </div>
          <form action={updateVotingStatus} className="inline-form">
            <input name="enabled" type="hidden" value={settings.votingEnabled ? "false" : "true"} />
            <button className="button" type="submit">
              {settings.votingEnabled ? "Close voting" : "Open voting"}
            </button>
          </form>
        </article>

        <article className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Reset</p>
              <h2>Clear all votes</h2>
            </div>
          </div>
          <form action={resetVotes}>
            <button className="button button--danger" type="submit">
              Reset votes
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Candidates</p>
            <h2>Current ballot</h2>
          </div>
        </div>

        {candidates.length === 0 ? (
          <p className="muted">No candidates found.</p>
        ) : (
          <div className="candidate-admin-list">
            {candidates.map((candidate) => (
              <form action={deleteCandidate} className="candidate-admin-item" key={candidate.id}>
                <div>
                  <p className="candidate-admin-name">{candidate.name}</p>
                  <p className="muted">ID {candidate.id}</p>
                </div>
                <input name="candidateId" type="hidden" value={candidate.id} />
                <button className="button button--ghost" type="submit">
                  Delete
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
