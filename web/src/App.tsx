import { lazy, Suspense } from "react";
import { AdopterApp } from "./adopter/AdopterApp";
import { NearbyPicker } from "./adopter/NearbyPicker";

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
  // ?drive=<id> is the one link per drive (WhatsApp group or gate poster): saplings near you.
  const tree = params.get("tree");
  if (!tree && params.get("drive")) return <NearbyPicker driveId={params.get("drive")!} />;
  return <AdopterApp treeId={tree ?? "dtu-gate3-017"} />;
}
