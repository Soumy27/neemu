// Water buddies (साथी रक्षक): adopters of nearby trees.
// BuddyList: ask one to cover today (Tree Home).
// BuddyReviews: check their proofs, "is it the same tree?" (Watering & Proof),
// which is how a tree is confirmed without anything attached to it.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Buddy, Cover, Review } from "../api/types";
import { initials } from "../shell/words";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

const avatarTones = ["sky", "mint", "amber"];

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
    <section className="card buddies-card">
      <div className="row">
        <span className="ms outline big-icon sky-text">group</span>
        <div>
          <h2 style={{ margin: 0 }}>Water Buddies · <span className="hi">साथी रक्षक</span></h2>
          <p className="muted small">Neighbours caring for trees near {treeName}. Can't make it today? Ask one to cover.</p>
        </div>
        <span style={{ flex: 1 }} />
        {buddies.length > 0 && <span className="pill sky">{buddies.length} nearby</span>}
      </div>
      {buddies.length === 0 && <p className="muted small">No buddies nearby yet.</p>}
      <div className="buddy-tiles">
        {buddies.map((b, i) => (
          <div key={b.handle} className="buddy-tile">
            <div className="row">
              <span className={`avatar ${avatarTones[i % 3]}`}>{initials(b.handle)}</span>
              <div>
                <div className="buddy-name">{b.handle}</div>
                <div className="muted small">{Math.round(b.distanceM)} m away · {b.treeName}</div>
              </div>
            </div>
            {asked?.to === b.handle ? (
              <span className="pill mint"><span className="ms">check</span>Asked</span>
            ) : (
              <button className="chip" onClick={() => ask(b.handle)} disabled={!!asked}><span className="ms outline">volunteer_activism</span>Ask to cover · <span className="hi">अनुरोध</span></button>
            )}
          </div>
        ))}
      </div>
      {asked && <p className="muted small rise">{asked.to} gets a message: “{me} can't make it today. Can you water {treeName}? It's {Math.round(asked.distanceM)} m from your tree.”</p>}
    </section>
  );
}

export function BuddyReviews({ me, onCount }: { me: string; onCount?: (n: number) => void }) {
  const [queue, setQueue] = useState<Review[]>([]);
  const [voted, setVoted] = useState<{ text: string; tone: string } | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    api.reviews(me).then((q) => { setQueue(q); onCount?.(q.length); }).catch(() => {});
  }, [me, onCount]);

  async function vote(r: Review, verdict: "same" | "unsure" | "different") {
    const res = await api.review(r.proofId, verdict, me);
    setVoted(
      res.review === "confirmed" ? { text: `Thanks. ${r.treeName}'s watering is confirmed.`, tone: "mint" }
        : res.review === "rejected" ? { text: "Thanks. That proof won't count.", tone: "rose" }
          : { text: "Thanks. Someone else will take a look too.", tone: "sky" },
    );
    setDone((d) => d + 1);
    setQueue((q) => q.filter((x) => x.proofId !== r.proofId));
  }

  const r = queue[0];
  return (
    <section className="card verify">
      <div className="row">
        <div>
          <h2 style={{ margin: 0 }}><span className="ms outline">groups</span> Community Verification</h2>
          <div className="verify-hi hi">सामुदायिक जांच</div>
        </div>
        <span style={{ flex: 1 }} />
        <span className="pill amber">{queue.length} pending</span>
      </div>

      {!r ? (
        <div className="empty-state">
          <span className="ms big-icon">task_alt</span>
          <p>{done > 0 ? "All caught up. Thank you!" : "Nothing to check right now."}</p>
          <p className="muted small">When a neighbour waters their sapling, you may be asked to confirm it's the same tree as its first photo.</p>
        </div>
      ) : (
        <div className="rise" key={r.proofId}>
          <p className="muted">Help check a watering proof for <strong>{r.treeName}</strong>, sent {ago(r.takenAt)}.</p>
          <div className="pair">
            <figure>
              <div className="photo-frame"><img src={r.referencePhotoUrl ?? ""} alt={`${r.treeName}, first photo`} /><span className="pill dark corner"><span className="hi">रोपण के दिन</span> · First photo</span></div>
              <figcaption>First day record</figcaption>
            </figure>
            <figure>
              <div className="photo-frame today"><img src={r.proofPhotoUrl} alt={`${r.treeName}, today`} /><span className="pill dark corner"><span className="live-dot" />Today · <span className="hi">आज</span></span></div>
              <figcaption>Today's submission</figcaption>
            </figure>
          </div>
          <div className="inner row small verify-facts">
            <span><span className="ms outline">location_on</span> {r.distanceM != null ? `${Math.round(r.distanceM)} m from the pin` : "No location"}{r.accuracyM != null ? ` (±${Math.round(r.accuracyM)} m)` : ""}</span>
            <span style={{ flex: 1 }} />
            <span><span className="ms outline">schedule</span> Server time recorded</span>
          </div>
          <h3 className="verify-q"><span className="hi">क्या यह वही पौधा है?</span></h3>
          <p className="muted center">Is it the same tree? Compare the leaves, the guard and what's behind it.</p>
          <div className="vote-row">
            <button className="vote same" onClick={() => vote(r, "same")}><span className="ms">check_circle</span><span>Same tree<small className="hi">वही पौधा है</small></span></button>
            <button className="vote unsure" onClick={() => vote(r, "unsure")}><span className="ms outline">help</span><span>Not sure<small className="hi">निश्चित नहीं</small></span></button>
            <button className="vote diff" onClick={() => vote(r, "different")}><span className="ms outline">cancel</span><span>Different<small className="hi">अलग पौधा</small></span></button>
          </div>
        </div>
      )}
      {voted && <p className={`pill ${voted.tone} rise`} style={{ marginTop: 12 }}>{voted.text}</p>}
    </section>
  );
}
