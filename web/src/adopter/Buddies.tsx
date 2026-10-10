// Water buddies (साथी रक्षक): adopters of nearby trees.
// BuddyList: ask one to cover today (My tree).
// BuddyReviews: check their proofs, "is it the same tree?" (Watering),
// which is how a tree is confirmed without anything attached to it.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Buddy, Cover, Review } from "../api/types";
import { initials } from "../shell/words";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function BuddyList({ treeId, treeName, me }: { treeId: string; treeName: string; me: string }) {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [asked, setAsked] = useState<Cover | null>(null);

  useEffect(() => {
    api.buddies(treeId).then((b) => setBuddies(b.slice(0, 3))).catch(() => {});
  }, [treeId]);

  async function ask(handle: string) {
    setAsked(await api.cover(treeId, handle));
  }

  return (
    <section className="section">
      <div className="section-title"><h2>Water buddies</h2><span className="hi-display">साथी रक्षक</span></div>
      <p className="muted">Neighbours who care for the saplings beside {treeName}. If you can't come today, ask one to cover.</p>
      {buddies.length === 0 && <p className="muted small">No buddies nearby yet.</p>}
      <ul className="ledger">
        {buddies.map((b) => (
          <li key={b.handle}>
            <span className="seal">{initials(b.handle)}</span>
            <span className="grow">
              <strong>{b.handle}</strong>
              <span className="muted small"> · {b.treeName}, <span className="num">{Math.round(b.distanceM)}</span> m away</span>
            </span>
            {asked?.to === b.handle
              ? <span className="mark fine">Asked</span>
              : <button className="quiet" onClick={() => ask(b.handle)} disabled={!!asked}>Ask to cover</button>}
          </li>
        ))}
      </ul>
      {asked && <p className="note rise">{asked.to} receives: “{me} can't make it today. Can you water {treeName}? It's {Math.round(asked.distanceM)} m from your tree.”</p>}
    </section>
  );
}

export function BuddyReviews({ me }: { me: string }) {
  const [queue, setQueue] = useState<Review[]>([]);
  const [voted, setVoted] = useState<{ text: string; tone: string } | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    api.reviews(me).then(setQueue).catch(() => {});
  }, [me]);

  async function vote(r: Review, verdict: "same" | "unsure" | "different") {
    const res = await api.review(r.proofId, verdict, me);
    setVoted(
      res.review === "confirmed" ? { text: `Thank you. ${r.treeName}'s watering is confirmed.`, tone: "fine" }
        : res.review === "rejected" ? { text: "Thank you. That proof won't count.", tone: "likely_dead" }
          : { text: "Thank you. Someone else will look too.", tone: "water" },
    );
    setDone((d) => d + 1);
    setQueue((q) => q.filter((x) => x.proofId !== r.proofId));
  }

  const r = queue[0];
  return (
    <section className="section verify">
      <div className="section-title">
        <h2>Is it the same tree?</h2>
        <span className="hi-display">क्या यह वही पौधा है?</span>
        <span className="grow" />
        <span className="mark plain num">{queue.length} waiting</span>
      </div>

      {!r ? (
        <div className="quiet-state">
          <p>{done > 0 ? "All checked. Thank you." : "Nothing to check right now."}</p>
          <p className="muted small">When a neighbour waters their sapling, you may be asked to compare their photo with the tree's first photo. A person can tell two saplings apart; GPS cannot.</p>
        </div>
      ) : (
        <div className="rise" key={r.proofId}>
          <p className="muted">A watering proof for <strong>{r.treeName}</strong>, sent {ago(r.takenAt)}.</p>
          <div className="pair diptych">
            <figure>
              <img src={r.referencePhotoUrl ?? ""} alt={`${r.treeName}, first photo`} />
              <figcaption><span className="hi">रोपण के दिन</span> · first photo</figcaption>
            </figure>
            <figure>
              <img src={r.proofPhotoUrl} alt={`${r.treeName}, today`} />
              <figcaption><span className="hi">आज</span> · today{r.distanceM != null && <>, <span className="num">{Math.round(r.distanceM)}</span> m from its pin</>}</figcaption>
            </figure>
          </div>
          <p className="muted small center">Compare the leaves, the guard, and what stands behind it.</p>
          <div className="verdicts">
            <button className="primary" onClick={() => vote(r, "same")}><span className="ms">check</span>Same tree <span className="hi">· वही है</span></button>
            <button onClick={() => vote(r, "unsure")}>Not sure <span className="hi">· पता नहीं</span></button>
            <button className="danger" onClick={() => vote(r, "different")}>Different <span className="hi">· अलग है</span></button>
          </div>
        </div>
      )}
      {voted && <p className={`mark ${voted.tone} rise`} style={{ marginTop: 14 }}>{voted.text}</p>}
    </section>
  );
}
