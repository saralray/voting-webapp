import { ResultsBoard } from "@/components/ResultsBoard";

export default function DashboardPage() {
  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">Dashboard</p>
        <h1>Dashboard</h1>
        <p className="lede">View current vote totals and download the report.</p>
        <div className="hero__actions">
          <a className="button" href="/api/export">
            Download Excel
          </a>
          <a className="button button--ghost" href="/">
            Back to vote
          </a>
        </div>
      </section>

      <ResultsBoard />
    </div>
  );
}
