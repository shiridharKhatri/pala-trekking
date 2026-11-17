import type { StyleSpecification } from "maplibre-gl";

// Dark basemap in the site's palette, built on free, keyless sources:
// - OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data)
// - AWS Open Data "Terrain Tiles" (terrarium-encoded elevation) for 3D relief
// Both require attribution, which the map shows in its attribution control.

export const MAP_HOSTS = ["https://tiles.openfreemap.org", "https://s3.amazonaws.com"];

const C = {
  canvas: "#0d1114",
  land: "#11171a",
  water: "#0c1d27",
  waterLine: "#16303d",
  ice: "#c9d6dc",
  wood: "#13201b",
  grass: "#141c18",
  road: "#2a3337",
  path: "#5b676b",
  label: "#9fabad",
  labelStrong: "#eceee8",
  halo: "#0d1114",
};

export function darkTerrainStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      },
      demHillshade: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
      },
      dem: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen, AWS Open Data</a>',
      },
    },
    terrain: { source: "dem", exaggeration: 1.35 },
    sky: {
      "sky-color": "#121a1f",
      "horizon-color": "#26313a",
      "fog-color": C.canvas,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.35,
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": C.land } },
      { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: ["==", ["get", "class"], "wood"], paint: { "fill-color": C.wood, "fill-opacity": 0.9 } },
      { id: "grass", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["grass", "farmland"]]], paint: { "fill-color": C.grass, "fill-opacity": 0.8 } },
      { id: "ice", type: "fill", source: "omt", "source-layer": "landcover", filter: ["==", ["get", "class"], "ice"], paint: { "fill-color": C.ice, "fill-opacity": 0.55 } },
      {
        id: "hillshade", type: "hillshade", source: "demHillshade",
        paint: { "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#3a474d", "hillshade-accent-color": "#1c2529", "hillshade-exaggeration": 0.65, "hillshade-illumination-direction": 315 },
      },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
      { id: "river", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": C.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 2] } },
      {
        id: "roads", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["!", ["in", ["get", "class"], ["literal", ["path", "track"]]]],
        paint: { "line-color": C.road, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 2] },
      },
      // Every mapped footpath and track (OpenStreetMap), visible from valley scale.
      {
        id: "trails", type: "line", source: "omt", "source-layer": "transportation", minzoom: 9,
        filter: ["in", ["get", "class"], ["literal", ["path", "track"]]],
        paint: { "line-color": "#8d9a9e", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 12, 1.1, 15, 2], "line-dasharray": [2, 1.5], "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.45, 12, 0.85] },
      },
      // Real buildings: lodges, houses and monasteries as low 3D blocks.
      {
        id: "buildings", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 13,
        paint: {
          "fill-extrusion-color": "#6b5a48",
          "fill-extrusion-height": ["max", ["coalesce", ["get", "render_height"], 5], 4],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.92,
        },
      },
      // Lodges and guesthouses, campsites and huts, monasteries: real OSM points.
      {
        id: "stay-pois", type: "circle", source: "omt", "source-layer": "poi", minzoom: 12,
        filter: ["any", ["in", ["get", "class"], ["literal", ["lodging", "campsite", "place_of_worship"]]], ["in", ["get", "subclass"], ["literal", ["alpine_hut", "wilderness_hut", "shelter", "guest_house", "hostel", "hotel", "camp_site", "monastery"]]]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 5],
          "circle-color": ["match", ["get", "class"], "campsite", "#6fb38a", "place_of_worship", "#c7b5e0", "#e0a640"],
          "circle-stroke-color": "#0d1114", "circle-stroke-width": 1.2,
        },
      },
      {
        id: "stay-poi-labels", type: "symbol", source: "omt", "source-layer": "poi", minzoom: 14,
        filter: ["all", ["has", "name"], ["any", ["in", ["get", "class"], ["literal", ["lodging", "campsite", "place_of_worship"]]], ["in", ["get", "subclass"], ["literal", ["alpine_hut", "wilderness_hut", "guest_house", "hostel", "hotel", "camp_site", "monastery"]]]]],
        layout: { "text-field": ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name_int"], ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-offset": [0, 0.9], "text-anchor": "top", "text-max-width": 9, "text-optional": true },
        paint: { "text-color": "#c9cfc8", "text-halo-color": C.halo, "text-halo-width": 1.3 },
      },
      {
        id: "hamlets", type: "symbol", source: "omt", "source-layer": "place", minzoom: 11,
        filter: ["in", ["get", "class"], ["literal", ["hamlet", "isolated_dwelling", "locality"]]],
        layout: { "text-field": ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name_int"], ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 9.5, "text-max-width": 8 },
        paint: { "text-color": "#8a9698", "text-halo-color": C.halo, "text-halo-width": 1.2 },
      },
      {
        id: "places", type: "symbol", source: "omt", "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
        layout: { "text-field": ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name_int"], ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 13, 12], "text-max-width": 8 },
        paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.4 },
      },
      {
        id: "peaks", type: "symbol", source: "omt", "source-layer": "mountain_peak",
        // rank 1 = most prominent peak in its tile; keeps the terrain readable.
        filter: ["all", ["has", "name"], ["has", "ele"], ["<=", ["coalesce", ["get", "rank"], 99], 1]],
        layout: {
          "text-field": ["format", ["concat", "▲ ", ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name_int"], ["get", "name:latin"], ["get", "name"]]], { "font-scale": 1 }, "\n", {}, ["concat", ["to-string", ["get", "ele"]], " m"], { "font-scale": 0.82 }],
          "text-font": ["Noto Sans Bold"],
          "text-size": 10.5,
          "text-anchor": "top",
          "text-offset": [0, 0.5],
          "symbol-sort-key": ["-", 0, ["coalesce", ["get", "ele"], 0]],
          "text-padding": 14,
        },
        paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.6 },
      },
    ],
  };
}
