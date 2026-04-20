"use client";

import { useEffect, useState } from "react";

export function ResultsBoard() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    summary: { voters: 0, votes: 0, candidates: 0 },
    results: []
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/results", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Unable to load dashboard data.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            summary: payload.summary,
            results: payload.results
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message
          }));
        }
      }
    }

    load();
    const timer = setInterval(load, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const maxVotes = Math.max(...state.results.map((item) => item.votes), 1);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Results</p>
          <h2>Current standings</h2>
        </div>
        {state.loading ? <p className="muted">Refreshing...</p> : null}
      </div>

      {state.error ? <p className="notice notice--danger">{state.error}</p> : null}

      <div className="metrics">
        <div className="metric">
          <p className="metric__label">Voters</p>
          <p className="metric__value">{state.summary.voters}</p>
        </div>
        <div className="metric">
          <p className="metric__label">Votes</p>
          <p className="metric__value">{state.summary.votes}</p>
        </div>
        <div className="metric">
          <p className="metric__label">Candidates</p>
          <p className="metric__value">{state.summary.candidates}</p>
        </div>
      </div>

      <div className="results-stack">
        {state.results.length === 0 ? (
          <p className="muted">No candidates yet.</p>
        ) : (
          state.results.map((item) => (
            <div className="bar-row" key={item.id}>
              <div className="bar-row__meta">
                <strong>{item.name}</strong>
                <span className="bar-row__count">{item.votes} votes</span>
              </div>
              <div className="bar-row__track">
                <div
                  className="bar-row__fill"
                  style={{ width: `${(item.votes / maxVotes) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
