// Water buddies: adopters of nearby trees. Ask one to cover today, and check
// their proofs ("is it the same tree?") so nothing needs to be marked on a tree.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Buddy, Cover, Review } from "../api/types";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function Buddies({ treeId, treeName, me }: { treeId: string; treeName: string; me: string }) {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [asked, setAsked] = useState<Cover | null>(null);
  const [queue, setQueue] = useState<Review[]>([]);
  const [voted, setVoted] = useState<string | null>(null);

  useEffect(() => {
    api.buddies(treeId).then((b) => setBuddies(b.slice(0, 3))).catch(() => {});
    api.reviews(me).then(setQueue).catch(() => {});
  }, [treeId, me]);

  async function ask(handle: string) {
    setAsked(await api.cover(treeId, handle));
  }

  async function vote(r: Review, verdict: "same" | "unsure" | "different") {
    const res = await api.review(r.proofId, verdict, me);
    setVoted(res.review === "confirmed" ? `Thanks. ${r.treeName}'s watering is confirmed.` : res.review === "rejected" ? "Thanks. That proof won't count." : "Thanks. Someone else will take a look too.");
    setQueue((q) => q.filter((x) => x.proofId !== r.proofId));
  }

  return (
    <>
      {queue.map((r) => (
        <section key={r.proofId} className="card review">
          <h2>Quick check for a buddy</h2>
          <p>Someone watered <strong>{r.treeName}</strong> near you {ago(r.takenAt)}. Is it the same tree as its first photo?</p>
          <div className="pair">
            <figure><img src={r.referencePhotoUrl ?? ""} alt={`${r.treeName}, first photo`} /><figcaption>First photo</figcaption></figure>
            <figure><img src={r.proofPhotoUrl} alt={`${r.treeName}, today`} /><figcaption>Today{r.distanceM != null && ` · ${Math.round(r.distanceM)} m from the pin`}</figcaption></figure>
          </div>
          <div className="row wrap">
            <button className="primary" onClick={() => vote(r, "same")}>✓ Same tree</button>
            <button onClick={() => vote(r, "unsure")}>? Not sure</button>
            <button onClick={() => vote(r, "different")}>✗ Different</button>
          </div>
        </section>
      ))}
      {voted && <p className="muted small">{voted}</p>}

      <section className="card">
        <h2>Water buddies</h2>
        <p className="muted">People looking after trees near {treeName}. Can't make it today? Ask one to cover.</p>
        {buddies.length === 0 && <p className="muted small">No buddies nearby yet.</p>}
        <ul className="buddies">
          {buddies.map((b) => (
            <li key={b.handle}>
              <span><strong>{b.handle}</strong> · {b.treeName}, {Math.round(b.distanceM)} m away</span>
              {asked?.to === b.handle ? (
                <span className="muted small">Asked ✓</span>
              ) : (
                <button onClick={() => ask(b.handle)} disabled={!!asked}>Ask to cover today</button>
              )}
            </li>
          ))}
        </ul>
        {asked && <p className="muted small">{asked.to} gets a message: "{me} can't make it today. Can you water {treeName}? It's {Math.round(asked.distanceM)} m from your tree."</p>}
      </section>
    </>
  );
}
