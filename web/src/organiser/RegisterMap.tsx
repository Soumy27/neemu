import type { FeatureCollection } from "geojson";
import { useEffect, useRef, useState } from "react";
import type { Tree } from "../api/types";
import { hasWebGl as detectWebGl, MAP_STYLE, maplibregl } from "./mapSetup";
import { statusColor } from "./status";

function toGeoJson(trees: Tree[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trees.map((t) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [t.location.lng, t.location.lat] },
      properties: { id: t.id, status: t.status },
    })),
  };
}

export function RegisterMap({ trees, selectedId, onSelect }: {
  trees: Tree[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [hasWebGl] = useState(detectWebGl);
  const fitted = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!hasWebGl) return;
    const map = new maplibregl.Map({ container: box.current!, style: MAP_STYLE, center: [77.1177, 28.7501], zoom: 16, maxZoom: 18 });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("trees", { type: "geojson", data: toGeoJson([]) });
      map.addLayer({
        id: "trees",
        type: "circle",
        source: "trees",
        paint: {
          "circle-radius": 8,
          "circle-color": ["match", ["get", "status"],
            "fine", statusColor.fine,
            "thirsty", statusColor.thirsty,
            "no_proof", statusColor.no_proof,
            statusColor.likely_dead],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "selected",
        type: "circle",
        source: "trees",
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#1f2a1d", "circle-stroke-width": 3 },
      });
      map.on("click", "trees", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current(id);
      });
      map.on("mouseenter", "trees", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "trees", () => (map.getCanvas().style.cursor = ""));
      setReady(true);
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [hasWebGl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("trees") as maplibregl.GeoJSONSource).setData(toGeoJson(trees));
    if (!trees.length) return;
    // Frame whatever is listed, so the saplings fill the map on load and after a filter.
    const b = new maplibregl.LngLatBounds();
    trees.forEach((t) => b.extend([t.location.lng, t.location.lat]));
    map.resize();
    map.fitBounds(b, { padding: 48, maxZoom: 18, animate: fitted.current });
    fitted.current = true;
  }, [ready, trees]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [ready, selectedId]);

  if (!hasWebGl) return <div className="error" role="alert">The map needs WebGL, which this browser has turned off. The table below still works.</div>;
  return <div ref={box} className="register-map" aria-label="Map of saplings, coloured by status" />;
}
