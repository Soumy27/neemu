import { useEffect, useRef, useState } from "react";
import type { Tree } from "../api/types";
import { hasWebGl as detectWebGl, MAP_STYLE, maplibregl } from "./mapSetup";

export interface LatLng { lat: number; lng: number }

// The map for placing one sapling: registered trees as small dots, and a pin that can be dragged or tapped into place.
export function PinMap({ trees, pin, onPlace }: {
  trees: Tree[];
  pin: LatLng | null;
  onPlace: (at: LatLng) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPlaceRef = useRef(onPlace);
  const [ready, setReady] = useState(false);
  const [hasWebGl] = useState(detectWebGl);
  const framed = useRef(false);

  useEffect(() => {
    onPlaceRef.current = onPlace;
  }, [onPlace]);

  useEffect(() => {
    if (!hasWebGl) return;
    const map = new maplibregl.Map({ container: box.current!, style: MAP_STYLE, center: [77.1177, 28.7501], zoom: 16, maxZoom: 18 });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("trees", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "trees",
        type: "circle",
        source: "trees",
        paint: { "circle-radius": 5, "circle-color": "#2f7d3a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
      });
      map.on("click", (e: maplibregl.MapMouseEvent) => onPlaceRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      setReady(true);
    });
    return () => {
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [hasWebGl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("trees") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: trees.map((t) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [t.location.lng, t.location.lat] },
        properties: {},
      })),
    });
    if (!framed.current && trees.length) {
      const b = new maplibregl.LngLatBounds();
      trees.forEach((t) => b.extend([t.location.lng, t.location.lat]));
      map.fitBounds(b, { padding: 48, maxZoom: 18, animate: false });
      framed.current = true;
    }
  }, [ready, trees]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!pin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true, color: "#b23a2a" }).setLngLat([pin.lng, pin.lat]).addTo(map);
      marker.on("dragend", () => {
        const at = marker.getLngLat();
        onPlaceRef.current({ lat: at.lat, lng: at.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([pin.lng, pin.lat]);
    }
    if (!map.getBounds().contains([pin.lng, pin.lat])) map.easeTo({ center: [pin.lng, pin.lat], zoom: 18 });
  }, [ready, pin]);

  if (!hasWebGl) return <div className="error" role="alert">The map needs WebGL, which this browser has turned off. Your position can still be used.</div>;
  return <div ref={box} className="register-map" aria-label="Map for placing the sapling. Tap to place the pin, drag to correct it." />;
}
