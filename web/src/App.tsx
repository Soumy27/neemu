import { AdopterApp } from "./adopter/AdopterApp";

// ?tree=<id> opens a tree (what the QR tag links to).
// ?view=organiser is Pratham's register screen (web/src/organiser/).
export default function App() {
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "organiser") {
    return <div className="loading">Organiser register: coming from web/src/organiser/.</div>;
  }
  return <AdopterApp treeId={params.get("tree") ?? "dtu-gate3-017"} />;
}
