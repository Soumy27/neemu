import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Vite cannot find the library's worker file on its own, so hand it over.
maplibregl.setWorkerUrl(workerUrl);

// OSM tiles until the Amazon Location Service map is set up; then set VITE_MAP_STYLE_URL.
export const MAP_STYLE: string | maplibregl.StyleSpecification = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) ?? {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 18,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const hasWebGl = () => !!document.createElement("canvas").getContext("webgl2");

export { maplibregl };
