import { lazy, Suspense } from "react";
import { AdopterApp } from "./adopter/AdopterApp";

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
  if (view === "organiser" || view === "add" || view === "poster") {
    const driveId = params.get("drive") ?? "dtu-eco-2026";
    return (
      <Suspense fallback={<div className="loading">Opening the register…</div>}>
        {view === "add" ? <AddSaplings driveId={driveId} /> : view === "poster" ? <Poster driveId={driveId} /> : <OrganiserApp driveId={driveId} />}
      </Suspense>
    );
  }
  return <AdopterApp treeId={params.get("tree") ?? "dtu-gate3-017"} />;
}
