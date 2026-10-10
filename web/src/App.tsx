import { lazy, Suspense } from "react";
import { AdopterApp } from "./adopter/AdopterApp";
import { NearbyPicker } from "./adopter/NearbyPicker";
import { ProofPage } from "./adopter/ProofPage";
import { Shell } from "./shell/Shell";

const GrovePage = lazy(() => import("./adopter/GrovePage").then((m) => ({ default: m.GrovePage })));

// The organiser screens load on demand so the map library stays out of the adopter app.
const OrganiserApp = lazy(() => import("./organiser/OrganiserApp"));
const AddSaplings = lazy(() => import("./organiser/AddSaplings"));
const Poster = lazy(() => import("./organiser/Poster"));

// ?tree=<id> opens a tree.
// ?view=organiser is the drive's survival register, ?view=add registers saplings by position and photo,
// ?view=poster is the one-page drive poster.
export default function App() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  const driveId = params.get("drive") ?? "dtu-eco-2026";
  if (view === "organiser" || view === "add" || view === "poster") {
    // The poster prints on its own; the organiser screens sit in the shared frame.
    const screen = (
      <Suspense fallback={<div className="loading">Opening the register…</div>}>
        {view === "add" ? <AddSaplings driveId={driveId} /> : view === "poster" ? <Poster driveId={driveId} /> : <OrganiserApp driveId={driveId} />}
      </Suspense>
    );
    return view === "poster" ? screen : <Shell tab="drive" driveId={driveId}>{screen}</Shell>;
  }
  if (view === "grove") {
    return (
      <Suspense fallback={<div className="loading">Planting the grove…</div>}>
        <GrovePage driveId={driveId} />
      </Suspense>
    );
  }
  if (view === "proof") return <ProofPage treeId={params.get("tree") ?? "dtu-gate3-017"} />;
  // ?drive=<id> is the one link per drive (WhatsApp group or gate poster): saplings near you.
  const tree = params.get("tree");
  if (!tree && params.get("drive")) return <NearbyPicker driveId={params.get("drive")!} />;
  return <AdopterApp treeId={tree ?? "dtu-gate3-017"} />;
}
