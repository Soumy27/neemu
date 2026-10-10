// In-app camera for proof photos. The tree's first photo sits on top as a faint
// "ghost" so the adopter frames the same view every time; that makes the manual
// same-tree check easy. No gallery upload, except in demo mode.

import { useEffect, useRef, useState } from "react";
import { usingMock } from "../api/client";

export function Camera({ referenceUrl, onShot, top }: { referenceUrl: string | null; onShot: (f: File) => void; top?: React.ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices) {
      setError("This browser has no camera access.");
      return;
    }
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("The camera isn't available. Allow camera access for this site and try again."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

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
        {error && (
          <div className="no-camera">
            <span className="ms">no_photography</span>
            <p>{error}</p>
          </div>
        )}
        <div className="vf-frame"><i /><i /><i /><i /></div>
        {top && <div className="top-pills">{top}</div>}
        {!error && (
          <div className="hint">
            {referenceUrl ? <><span className="hi">पहली फोटो से सीध मिलाएं</span> · Line up with the faint first photo</> : "Get the whole sapling and its guard in the frame"}
          </div>
        )}
        <div className="shutter-row">
          <button className="cam-side" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="Switch camera"><span className="ms">cameraswitch</span></button>
          <button className="shutter" onClick={shoot} disabled={!!error} aria-label="Take photo"><span className="ms">potted_plant</span></button>
          {usingMock ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onShot(e.target.files[0])} />
              <button className="cam-side" onClick={() => fileRef.current?.click()} aria-label="Demo: pick a file"><span className="ms">photo_library</span></button>
            </>
          ) : <span style={{ width: 48 }} />}
        </div>
      </div>
    </div>
  );
}
