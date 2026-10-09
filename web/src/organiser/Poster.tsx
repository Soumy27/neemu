import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Drive } from "../api/types";
import { errorText } from "./organiserApi";
import { Qr } from "./Qr";
import "./organiser.css";

// Where the drive link opens. Set VITE_APP_URL once the app has its host, then reprint.
const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined) ?? location.origin).replace(/\/$/, "");

// One poster for the whole drive, for the gate or the WhatsApp group. Nothing goes on the trees.
export default function Poster({ driveId }: { driveId: string }) {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getDrive(driveId).then(setDrive).catch((e) => setError(errorText(e)));
  }, [driveId]);

  if (!drive) return <div className="loading">{error ?? "Making the poster…"}</div>;

  const link = `${APP_URL}/?drive=${encodeURIComponent(driveId)}`;
  const message = `${drive.name}: ${drive.trees.length} saplings need someone to water them. Adopt one near you, it will tell you when it is thirsty: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the message and copy it by hand.");
    }
  }

  return (
    <div className="tags">
      <header className="org-head no-print">
        <div>
          <h1>Drive poster</h1>
          <p className="muted">One link for the whole drive. Put it at the gate or in the group chat.</p>
        </div>
        <div className="row">
          <a className="button" href={`?view=organiser&drive=${encodeURIComponent(driveId)}`}>Back to register</a>
          <button className="primary" onClick={() => print()}>Print</button>
        </div>
      </header>

      <div className="poster">
        <h2 className="poster-title" lang="hi">एक पौधा गोद लो</h2>
        <p className="poster-sub">Adopt a sapling. It tells you when it is thirsty.</p>
        <Qr text={link} />
        <ol className="poster-steps">
          <li>Scan, and find the saplings near you.</li>
          <li>Pick one. It is yours to look after.</li>
          <li>Water it when it asks, and send a photo.</li>
        </ol>
        <p className="poster-foot">{drive.name} · {drive.organiser}<br /><span className="poster-link">{link}</span></p>
      </div>

      <section className="card no-print">
        <h2>Message for the group</h2>
        <p className="share-text">{message}</p>
        <div className="row">
          <button onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
          <a className="button" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
      </section>
    </div>
  );
}
