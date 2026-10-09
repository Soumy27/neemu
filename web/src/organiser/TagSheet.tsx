import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api, SourceError } from "../api/client";
import type { Drive } from "../api/types";
import "./organiser.css";

// Where a scanned tag opens. Set VITE_APP_URL once the app has its host, then reprint.
const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined) ?? location.origin).replace(/\/$/, "");

const tagUrl = (treeId: string) => `${APP_URL}/?tree=${encodeURIComponent(treeId)}`;

// High error correction: the tag sits outdoors and has to be read out of a watering photo.
function Qr({ text }: { text: string }) {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: "H" }).modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg className="qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label={`QR code for ${text}`}>
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export default function TagSheet({ driveId }: { driveId: string }) {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDrive(driveId).then(setDrive).catch((e) => setError(e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e)));
  }, [driveId]);

  if (!drive) return <div className="loading">{error ?? "Making the tags…"}</div>;

  return (
    <div className="tags">
      <header className="org-head no-print">
        <div>
          <h1>QR tags</h1>
          <p className="muted">{drive.name} · {drive.trees.length} tags · each opens {APP_URL}/?tree=…</p>
          <p className="muted small">Print, cut, laminate and tie one to each tree guard. The tag must be in every watering photo.</p>
        </div>
        <div className="row">
          <a className="button" href={`?view=organiser&drive=${encodeURIComponent(driveId)}`}>Back to register</a>
          <button className="primary" onClick={() => print()}>Print</button>
        </div>
      </header>

      <div className="tag-grid">
        {drive.trees.map((t) => (
          <div key={t.id} className="tag">
            <Qr text={tagUrl(t.id)} />
            <div className="tag-name">{t.name}</div>
            <div className="tag-hi" lang="hi">मुझे पानी दो, मुझे गोद लो</div>
            <div className="tag-id">{t.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
