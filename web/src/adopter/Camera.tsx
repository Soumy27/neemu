// In-app camera for proof photos. The reference photo sits on top as a faint
// "ghost" so the adopter frames the same view every time; that makes the
// manual same-tree review easy. No gallery upload, except in demo mode.

import { useEffect, useRef, useState } from "react";
import { usingMock } from "../api/client";

export function Camera({ referenceUrl, onShot, onCancel }: { referenceUrl: string | null; onShot: (f: File) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("The camera isn't available. Allow camera access for this site and try again."));
    if (!navigator.mediaDevices) setError("This browser has no camera access.");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onShot(new File([b], `proof-${Date.now()}.jpg`, { type: "image/jpeg" })), "image/jpeg", 0.85);
  }

  return (
    <div className="camera">
      <div className="viewfinder">
        <video ref={video} autoPlay playsInline muted />
        {referenceUrl && <img className="ghost" src={referenceUrl} alt="" />}
        <div className="hint">{referenceUrl ? "Line up with the faint first photo" : "Get the whole sapling and its guard in the frame"}</div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row wrap">
        <button className="primary" onClick={shoot} disabled={!!error}>📸 Take photo</button>
        <button onClick={onCancel}>Cancel</button>
        {usingMock && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onShot(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}>Demo: pick a file</button>
          </>
        )}
      </div>
    </div>
  );
}
