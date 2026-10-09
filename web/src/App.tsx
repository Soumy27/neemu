import { lazy, Suspense } from "react";
import { AdopterApp } from "./adopter/AdopterApp";

// The organiser screens load on demand so the map library stays out of the adopter app.
const OrganiserApp = lazy(() => import("./organiser/OrganiserApp"));
const TagSheet = lazy(() => import("./organiser/TagSheet"));

// ?tree=<id> opens a tree (what the QR tag links to).
// ?view=organiser is the drive's survival register; ?view=tags is its printable QR tags.
export default function App() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  if (view === "organiser" || view === "tags") {
    const driveId = params.get("drive") ?? "dtu-eco-2026";
    return (
      <Suspense fallback={<div className="loading">Opening the register…</div>}>
        {view === "tags" ? <TagSheet driveId={driveId} /> : <OrganiserApp driveId={driveId} />}
      </Suspense>
    );
  }
  return <AdopterApp treeId={params.get("tree") ?? "dtu-gate3-017"} />;
}
