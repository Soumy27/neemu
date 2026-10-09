import { useEffect, useState } from "react";
import { errorText, organiserApi } from "./organiserApi";
import type { Review, ReviewVerdict } from "./organiserApi";

function ago(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}

const outcome: Record<string, string> = {
  confirmed: "Confirmed. The watering stays on the record.",
  rejected: "Marked as a different tree. The credit is undone.",
  pending: "Left for a water buddy to check.",
};

// Nothing on the trees says which one a photo shows, so a person checks a share of proofs against the reference photo.
export function ReviewQueue({ driveId }: { driveId: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    organiserApi.getReviews(driveId).then(setReviews).catch((e) => setError(errorText(e)));
  }, [driveId]);

  async function vote(r: Review, verdict: ReviewVerdict) {
    setBusy(r.proofId);
    setError(null);
    try {
      const done = await organiserApi.review(r.proofId, verdict);
      setReviews((list) => list?.filter((x) => x.proofId !== r.proofId) ?? null);
      setLast(`${r.treeName}: ${outcome[done.review]}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <h2>Proofs to check{reviews ? ` (${reviews.length})` : ""}</h2>
      <p className="muted">Is the watering photo the same tree as its reference photo? Distance and GPS accuracy were already checked by code.</p>
      {last && <p className="result accepted" role="status">{last}</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {reviews?.length === 0 && <p className="muted">Nothing waiting.</p>}
      <div className="reviews">
        {reviews?.map((r) => (
          <article key={r.proofId} className="review">
            <div className="pair">
              <figure><img src={r.referencePhotoUrl} alt={`Reference photo of ${r.treeName}`} /><figcaption>Reference</figcaption></figure>
              <figure><img src={r.proofPhotoUrl} alt={`Watering photo for ${r.treeName}`} /><figcaption>Watering photo, {ago(r.takenAt)}</figcaption></figure>
            </div>
            <p className="review-meta">
              <strong>{r.treeName}</strong> <code>{r.treeId}</code><br />
              <span className="muted small">
                {r.distanceM === null ? "No position sent" : `${r.distanceM} m from the tree`}
                {r.accuracyM !== null && ` · GPS accurate to ${r.accuracyM} m`}
              </span>
            </p>
            <div className="row wrap">
              <button className="primary" disabled={busy === r.proofId} onClick={() => vote(r, "same")}>Same tree</button>
              <button disabled={busy === r.proofId} onClick={() => vote(r, "unsure")}>Not sure</button>
              <button className="danger" disabled={busy === r.proofId} onClick={() => vote(r, "different")}>Different tree</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
