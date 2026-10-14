// Track Me – homepage
// Maps and other features come in later stages.

// 1. Category chips: highlight the clicked chip and filter the place cards
const chips = document.querySelectorAll(".chip");
const cardsBox = document.querySelector(".cards");
const emptyState = document.getElementById("empty-state");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let fadeTimer;

let feedMode = "sample"; // what the feed shows: "sample" | "loading" | "error" | "empty" | "ready"

// Cards are looked up each time, so this works for the sample cards and for real results
function filterCards(category, instant) {
  clearTimeout(fadeTimer);
  const cards = document.querySelectorAll(".card[data-category]");
  const toShow = [];
  const toHide = [];
  cards.forEach((card) => {
    const match = category === "all" || card.dataset.category === category;
    (match ? toShow : toHide).push(card);
  });

  // Step 1: fade out the cards that don't match (and hide the empty message)
  const quick = instant || reduceMotion;
  emptyState.hidden = true;
  if (!quick) toHide.forEach((card) => card.classList.add("is-hiding"));

  // Step 2: once faded, remove them from the layout and fade the matching cards in
  const finish = () => {
    toHide.forEach((card) => { card.hidden = true; });
    toShow.forEach((card) => {
      if (card.hidden) {
        card.hidden = false;
        card.classList.add("is-hiding"); // start faded out, then transition in
      }
    });
    void cardsBox.offsetHeight; // let the browser register the starting state
    toShow.forEach((card) => card.classList.remove("is-hiding"));
    const showingCards = feedMode === "sample" || feedMode === "ready";
    emptyState.hidden = toShow.length > 0 || !showingCards;
  };
  if (quick) finish();
  else fadeTimer = setTimeout(finish, 250);
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.classList.contains("is-active")) return;
    const key = chip.dataset.filter;
    chips.forEach((c) => { // the homepage chips and the map chips stay in sync
      const on = c.dataset.filter === key;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    filterCards(key);
    applyMapFilter(key); // map markers use the same filter (no new request)
  });
});

// Bottom navigation: the Map item opens the map view; the other items are visual only for now
const navItems = document.querySelectorAll(".nav-item");

function setNavActive(name) {
  navItems.forEach((n) => {
    const on = n.dataset.nav === name;
    n.classList.toggle("is-active", on);
    if (on) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    setNavActive(item.dataset.nav);
    if (item.dataset.nav === "map") openMapView();
    else {
      if (mapView && !mapView.hidden) closeMapView(true);
      if (typeof handleNav === "function") handleNav(item.dataset.nav); // profile view (js/social.js)
    }
  });
});

// 2. Place photos: if one fails to load, remove it so the gradient + icon fallback shows
document.querySelectorAll(".card__img img").forEach((img) => {
  const drop = () => img.remove();
  img.addEventListener("error", drop);
  if (img.complete && img.naturalWidth === 0) drop();
});

// 3. Friendly warning if the stylesheet did not load (usually a wrong folder/path)
window.addEventListener("load", () => {
  const loaded = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  if (!loaded) {
    const msg = 'Track Me: css/style.css did not load. Keep it at css/style.css, next to index.html.';
    console.warn(msg);
    const bar = document.createElement("div");
    bar.textContent = msg;
    bar.setAttribute("style", "padding:12px;background:#6C4BF4;color:#fff;font:14px sans-serif");
    document.body.prepend(bar);
  }
});

// Live map preview: pause the moving dots and boats for people who prefer reduced motion
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const mapSvg = document.querySelector(".map-svg");
  if (mapSvg && mapSvg.pauseAnimations) mapSvg.pauseAnimations();
}

// 4. Find My Location (runs only after the user clicks the button)
// The location lives in memory for this visit only: it is never saved to
// localStorage, sent to a database or shared. Later features can read appState.location.
const appState = {
  location: null, // { lat, lng, accuracy, label, source: "gps", timestamp }
  places: [], // nearby places from Stage 4 (the map reuses these, no new request)
};

(function initLocation() {
  const findBtn = document.getElementById("find-location");
  const box = document.getElementById("loc-status");
  const textEl = document.getElementById("loc-text");
  const retryBtn = document.getElementById("loc-retry");
  if (!findBtn || !box || !textEl || !retryBtn) return; // missing elements: do nothing, no errors

  const geocodeCache = new Map(); // avoids repeat requests to Nominatim for the same spot
  let busy = false;
  let retryAction = null;

  function show(state, message, retry) {
    box.hidden = false;
    box.dataset.state = state;
    textEl.textContent = message;
    retryAction = retry ? retry.action : null;
    retryBtn.hidden = !retry;
    if (retry) retryBtn.textContent = retry.label;
  }

  function setBusy(value) {
    busy = value;
    findBtn.disabled = value;
    findBtn.setAttribute("aria-busy", String(value));
  }

  // Nominatim: public, free, light use only (max 1 request/second). We make one request
  // per successful location, and cache the result.
  function placeName(data) {
    const a = data.address || {};
    const parts = [
      a.suburb || a.neighbourhood || a.city_district || a.quarter || a.village || a.hamlet,
      a.city || a.town || a.municipality || a.county,
      a.state,
    ].filter(Boolean);
    const unique = parts.filter((p, i) => parts.indexOf(p) === i).slice(0, 3);
    if (unique.length) return unique.join(", ");
    return (data.display_name || "").split(", ").slice(0, 3).join(", ");
  }

  async function reverseGeocode(lat, lng) {
    const key = lat.toFixed(3) + "," + lng.toFixed(3);
    if (geocodeCache.has(key)) return geocodeCache.get(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const params = new URLSearchParams({
        lat: lat,
        lon: lng,
        format: "jsonv2",
        zoom: "14", // neighbourhood level: approximate, not an exact address
        addressdetails: "1",
        "accept-language": navigator.language || "en",
      });
      const res = await fetch("https://nominatim.openstreetmap.org/reverse?" + params, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Reverse geocoding failed: " + res.status);
      const name = placeName(await res.json());
      if (!name) throw new Error("No place name found");
      geocodeCache.set(key, name);
      return name;
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolveName() {
    const loc = appState.location;
    if (!loc || busy) return;
    setBusy(true);
    show("loading", "Looking up the place name...");
    try {
      loc.label = await reverseGeocode(loc.lat, loc.lng);
      show("success", "You're near " + loc.label + ".");
    } catch (err) {
      loc.label = null;
      show(
        "success",
        "Location found (" + loc.lat.toFixed(3) + ", " + loc.lng.toFixed(3) +
          "). We couldn't look up the place name right now.",
        { label: "Try place name again", action: resolveName }
      );
    } finally {
      setBusy(false);
    }
  }

  function onPosition(pos) {
    appState.location = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      label: null,
      source: "gps",
      timestamp: pos.timestamp,
    };
    setBusy(false);
    resolveName();
    loadNearbyPlaces(appState.location); // real nearby places for these coordinates
  }

  function onError(err) {
    setBusy(false);
    const serverTip =
      location.protocol === "file:" || !window.isSecureContext
        ? " Tip: run the project with a local server (for example python -m http.server) and open it at http://localhost instead of opening the file directly."
        : "";
    let message;
    if (err.code === 1) {
      message = "Location access was blocked. Allow location for this site in your browser settings, then try again." + serverTip;
    } else if (err.code === 3) {
      message = "Finding your location took too long. Please try again.";
    } else {
      message = "We couldn't work out where you are. Check that location is turned on and try again." + serverTip;
    }
    show("error", message, { label: "Try again", action: findLocation });
  }

  function findLocation() {
    if (busy) return;
    // Coordinates already in memory: don't ask the browser again, just make sure places are loaded
    if (appState.location) {
      loadNearbyPlaces(appState.location);
      if (appState.location.label) show("success", "You're near " + appState.location.label + ".");
      else resolveName();
      return;
    }
    if (!navigator.geolocation) {
      show("error", "This browser doesn't support location detection.", null);
      return;
    }
    setBusy(true);
    show("loading", "Finding your location...");
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
  }

  findBtn.addEventListener("click", findLocation);
  retryBtn.addEventListener("click", () => { if (retryAction) retryAction(); });
})();

// 5. Nearby places: real data from OpenStreetMap, through the public Overpass API
const PLACES_CONFIG = {
  radiusMeters: 3000, // search radius around the user: change this to search wider or smaller
  maxPerCategory: 12, // show the nearest N places of each category
  overpassUrl: "https://overpass-api.de/api/interpreter",
  timeoutMs: 30000,
};

// Category -> OpenStreetMap tags. The keys match the data-filter values of the chips.
const PLACE_CATEGORIES = {
  shopping: { label: "Shopping", icon: "bag", img: 5, tags: { shop: ["mall", "department_store"] } },
  supermarkets: { label: "Supermarkets", icon: "cart", img: 2, tags: { shop: ["supermarket", "grocery"] } },
  restaurants: { label: "Restaurants", icon: "utensils", img: 3, tags: { amenity: ["restaurant", "fast_food"] } },
  cafes: { label: "Cafés", icon: "coffee", img: 1, tags: { amenity: ["cafe"] } },
  hangouts: {
    label: "Hangouts", icon: "sparkles", img: 6,
    tags: { amenity: ["bar", "pub", "nightclub", "cinema", "theatre"], leisure: ["amusement_arcade", "bowling_alley"] },
  },
  parks: {
    label: "Parks", icon: "tree", img: 4,
    tags: { leisure: ["park", "garden", "playground", "nature_reserve", "recreation_ground"] },
  },
  essentials: { label: "Essentials", icon: "plus", img: 7, tags: { amenity: ["pharmacy", "hospital", "atm"] } },
};

// Friendly names for the OpenStreetMap tag values (anything missing is tidied automatically)
const PLACE_TYPE_LABELS = {
  mall: "Shopping centre", department_store: "Department store", supermarket: "Supermarket",
  grocery: "Grocery store", restaurant: "Restaurant", fast_food: "Fast food", cafe: "Café",
  bar: "Bar", pub: "Pub", nightclub: "Nightclub", cinema: "Cinema", theatre: "Theatre",
  amusement_arcade: "Arcade", bowling_alley: "Bowling", park: "Park", garden: "Garden",
  playground: "Playground", nature_reserve: "Nature reserve", recreation_ground: "Recreation ground",
  pharmacy: "Pharmacy", hospital: "Hospital", atm: "ATM",
};

const placesStatus = document.getElementById("places-status");
const placesText = document.getElementById("places-text");
const placesRetry = document.getElementById("places-retry");
const discoverNote = document.getElementById("discover-note");
let placesLoading = false;
let placesKey = null; // coordinates + radius we already loaded, so we don't ask twice

// One query for every category (not one request per category)
function buildQuery(lat, lng) {
  const valuesByKey = {};
  Object.values(PLACE_CATEGORIES).forEach((cat) => {
    Object.entries(cat.tags).forEach(([key, values]) => {
      valuesByKey[key] = (valuesByKey[key] || []).concat(values);
    });
  });
  const around = "(around:" + PLACES_CONFIG.radiusMeters + "," + lat.toFixed(4) + "," + lng.toFixed(4) + ")";
  const lines = Object.entries(valuesByKey).map(
    ([key, values]) => 'nwr["' + key + '"~"^(' + values.join("|") + ')$"]' + around + ";"
  );
  return "[out:json][timeout:25];(" + lines.join("") + ");out center tags;"; // "center" gives ways/relations a point
}

async function fetchPlaces(lat, lng) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_CONFIG.timeoutMs);
  try {
    const res = await fetch(PLACES_CONFIG.overpassUrl, {
      method: "POST",
      body: new URLSearchParams({ data: buildQuery(lat, lng) }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Overpass answered with status " + res.status); // e.g. 429 busy, 504 timeout
    const data = await res.json();
    if (data.remark && /runtime error/i.test(data.remark)) throw new Error("Overpass: " + data.remark);
    return data.elements || [];
  } finally {
    clearTimeout(timer);
  }
}

// Haversine formula: distance in metres between two latitude/longitude points
function distanceMeters(lat1, lng1, lat2, lng2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function formatDistance(meters) {
  if (meters < 1000) return (Math.round(meters / 10) * 10 || 10) + " m away";
  return (meters / 1000).toFixed(1) + " km away";
}

function matchCategory(tags) {
  for (const [category, cat] of Object.entries(PLACE_CATEGORIES)) {
    for (const [key, values] of Object.entries(cat.tags)) {
      if (values.includes(tags[key])) return { category, type: tags[key] };
    }
  }
  return null;
}

function placeName(tags, type) {
  const name = tags.name || tags["name:en"] || tags.brand || tags.operator;
  if (!name) return null; // we don't invent names
  return type === "atm" && !/atm/i.test(name) ? name + " ATM" : name;
}

// Turn raw Overpass elements into clean places, nearest first
function parsePlaces(elements, origin) {
  const found = [];
  let unnamed = 0;
  elements.forEach((el) => {
    if (!["node", "way", "relation"].includes(el.type) || !Number.isInteger(el.id)) return;
    const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat; // ways/relations use their centre
    const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
    if (typeof lat !== "number" || typeof lng !== "number") return; // no usable coordinates
    const tags = el.tags || {};
    const match = matchCategory(tags);
    if (!match) return;
    const name = placeName(tags, match.type);
    if (!name) { unnamed++; return; }
    found.push({
      name, category: match.category, osmType: el.type, osmId: el.id, lat, lng,
      typeLabel: PLACE_TYPE_LABELS[match.type] || match.type.replace(/_/g, " "),
      distance: distanceMeters(origin.lat, origin.lng, lat, lng),
    });
  });
  found.sort((a, b) => a.distance - b.distance);

  // Remove duplicates: the same name and category within 150 m (e.g. a point and a building)
  const seen = new Map();
  const perCategory = {};
  const places = [];
  found.forEach((p) => {
    const key = p.category + "|" + p.name.toLowerCase();
    const near = seen.get(key) || [];
    if (near.some((q) => distanceMeters(q.lat, q.lng, p.lat, p.lng) < 150)) return;
    seen.set(key, near.concat(p));
    perCategory[p.category] = (perCategory[p.category] || 0) + 1;
    if (perCategory[p.category] <= PLACES_CONFIG.maxPerCategory) places.push(p);
  });
  return { places, total: seen.size, unnamed };
}

// Reuses the existing card markup and classes. Text is set with textContent (safe).
function createPlaceCard(place) {
  const cat = PLACE_CATEGORIES[place.category];
  const card = document.createElement("article");
  card.className = "card reveal";
  card.dataset.category = place.category;
  card.innerHTML =
    '<div class="card__img card__img--' + cat.img + '">' +
    '<svg class="icon icon--xl" width="44" height="44"><use href="#i-' + cat.icon + '"/></svg>' +
    '<span class="badge">OpenStreetMap</span></div>' +
    '<div class="card__body"><h3></h3><p class="card__cat"></p>' +
    '<p class="card__dist"><svg class="icon icon--sm" width="16" height="16"><use href="#i-pin"/></svg> <span></span></p>' +
    '<a class="btn btn--sm card__view" target="_blank" rel="noopener noreferrer">View place</a></div>';
  card.querySelector("h3").textContent = place.name;
  card.querySelector(".card__cat").textContent = place.typeLabel;
  card.querySelector(".card__dist span").textContent = formatDistance(place.distance);
  const link = card.querySelector(".card__view");
  link.href = "https://www.openstreetmap.org/" + place.osmType + "/" + place.osmId;
  link.setAttribute("aria-label", "View " + place.name + " on OpenStreetMap");
  return card;
}

function showPlacesStatus(state, message, canRetry) {
  placesStatus.hidden = false;
  placesStatus.classList.toggle("is-loading", state === "loading");
  placesText.textContent = message;
  placesRetry.hidden = !canRetry;
}

async function loadNearbyPlaces(loc) {
  if (!loc || !cardsBox || !placesStatus || !placesText || !placesRetry) return;
  const key = loc.lat.toFixed(3) + "," + loc.lng.toFixed(3) + "@" + PLACES_CONFIG.radiusMeters;
  if (placesLoading || key === placesKey) return; // no duplicate requests for the same spot

  placesLoading = true;
  feedMode = "loading";
  appState.places = [];
  cardsBox.replaceChildren(); // the sample cards give way to real results
  emptyState.hidden = true;
  showPlacesStatus("loading", "Discovering places near you...", false);
  const chipRow = document.querySelector(".chips"); // scroll so the category chips and results are in view
  if (chipRow) chipRow.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

  try {
    const elements = await fetchPlaces(loc.lat, loc.lng);
    const { places, total, unnamed } = parsePlaces(elements, loc);
    placesKey = key;
    appState.places = places;
    if (!places.length) {
      feedMode = "empty";
      showPlacesStatus("empty", "We couldn't find mapped places nearby. Try a larger area or another location.", false);
    } else {
      feedMode = "ready";
      cardsBox.replaceChildren(...places.map(createPlaceCard));
      placesStatus.hidden = true;
      if (discoverNote) {
        const r = PLACES_CONFIG.radiusMeters;
        discoverNote.textContent =
          "Real places from OpenStreetMap within " + (r >= 1000 ? r / 1000 + " km" : r + " m") +
          " of your location (nearest " + PLACES_CONFIG.maxPerCategory + " per category). Mapping is incomplete, so some places may be missing, and ratings, photos and opening hours aren't available." +
          (unnamed ? " " + unnamed + " unnamed places were left out." : "");
      }
      const active = document.querySelector(".chip.is-active");
      filterCards(active ? active.dataset.filter : "all", true); // apply the current category, no new request
    }
  } catch (err) {
    console.warn("Nearby places failed:", err);
    feedMode = "error";
    showPlacesStatus("error", "We couldn't load nearby places right now. Please try again.", true);
  } finally {
    placesLoading = false;
    onPlacesChanged(); // let the map know (if it is open)
  }
}

if (placesRetry) placesRetry.addEventListener("click", () => loadNearbyPlaces(appState.location));

// 6. Interactive map: Leaflet + OpenStreetMap tiles.
// It reuses appState.location and appState.places, so no new API request is needed for the markers.
const mapView = document.getElementById("map-view");
const mapEl = document.getElementById("leaflet-map");
const mapMsg = document.getElementById("map-msg");
const mapMsgText = document.getElementById("map-msg-text");
const mapMsgBtn = document.getElementById("map-msg-btn");

const PLACE_COLORS = {
  shopping: "#FF5FA2", supermarkets: "#22BB86", restaurants: "#FF8A3D", cafes: "#D9962B",
  hangouts: "#7B4DFF", parks: "#4CC05A", essentials: "#E5484D",
};

let leafletMap = null; // created once, then reused every time the map view opens
let tileLayer = null;
let placeLayer = null; // holds only the markers that match the current category
let userMarker = null;
let accuracyCircle = null;
let placeMarkers = []; // { category, marker } for every place
let drawnPlaces = null; // which data the markers were built from (avoids rebuilding)
let drawnLocation = null;
let tileErrors = 0;
let tileFailed = false;
let msgAction = null;
let reopenMapAt = 0; // set when the user starts "Find My Location" from the map

function showMapMessage(text, buttonLabel, action) {
  if (!mapMsg) return;
  mapMsg.hidden = false;
  mapMsgText.textContent = text;
  mapMsgBtn.hidden = !buttonLabel;
  if (buttonLabel) mapMsgBtn.textContent = buttonLabel;
  msgAction = action || null;
}

function hideMapMessage() {
  if (mapMsg) mapMsg.hidden = true;
}

// Decides which (if any) helpful message to show over the map
function updateMapMessage() {
  if (!leafletMap) return;
  if (tileFailed) {
    showMapMessage("Map tiles couldn't be loaded. Check your connection and try again.", "Try again", () => {
      tileErrors = 0;
      tileFailed = false;
      tileLayer.redraw();
      updateMapMessage();
    });
  } else if (!appState.location) {
    showMapMessage("Find your location to see places around you.", "Find My Location", findFromMap);
  } else if (placesLoading) {
    showMapMessage("Discovering places near you...");
  } else if (!appState.places.length) {
    showMapMessage("There are no mapped places to show here yet.");
  } else if (!placeLayer.getLayers().length) {
    showMapMessage("No places in this category on the map.");
  } else {
    hideMapMessage();
  }
}

function initMap() {
  if (leafletMap) return true; // only ever create one map
  if (typeof L === "undefined" || !mapEl) {
    showMapMessage("The map couldn't load. Check your internet connection, then reload the page.", "Reload", () => window.location.reload());
    return false;
  }
  leafletMap = L.map(mapEl, { minZoom: 2, worldCopyJump: true }).setView([20, 0], 2); // world view until we have a location
  tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(leafletMap);
  tileLayer.on("tileload", () => {
    tileErrors = 0;
    if (tileFailed) { tileFailed = false; updateMapMessage(); }
  });
  tileLayer.on("tileerror", () => {
    tileErrors++;
    if (tileErrors >= 3 && !tileFailed) { tileFailed = true; updateMapMessage(); }
  });
  placeLayer = L.layerGroup().addTo(leafletMap);
  return true;
}

function drawUser(loc) {
  if (userMarker) leafletMap.removeLayer(userMarker);
  if (accuracyCircle) leafletMap.removeLayer(accuracyCircle);
  userMarker = L.marker([loc.lat, loc.lng], {
    icon: L.divIcon({
      className: "user-marker",
      html: '<span class="user-marker__pulse"></span><span class="user-marker__dot"></span>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    title: "You are here",
    zIndexOffset: 1000, // always above the place markers
  }).addTo(leafletMap);
  userMarker.bindPopup("You are here" + (loc.label ? ": " + loc.label : ""));
  if (loc.accuracy && loc.accuracy < 1500) { // only show the accuracy circle when it is a sensible size
    accuracyCircle = L.circle([loc.lat, loc.lng], {
      radius: loc.accuracy, color: "#0FADFF", weight: 1.5, fillColor: "#0FADFF", fillOpacity: 0.12, interactive: false,
    }).addTo(leafletMap);
  }
}

function makePlaceIcon(category) {
  const cat = PLACE_CATEGORIES[category];
  return L.divIcon({
    className: "", // no default Leaflet icon styling
    html: '<div class="pin-marker" style="--c:' + PLACE_COLORS[category] + '"><svg class="icon" width="20" height="20"><use href="#i-' + cat.icon + '"/></svg></div>',
    iconSize: [40, 40],
    iconAnchor: [20, 48],
    popupAnchor: [0, -46],
  });
}

// Popup content is built with textContent so place names are always treated as plain text
function makePopup(place) {
  const wrap = document.createElement("div");
  wrap.className = "map-popup";
  wrap.innerHTML =
    '<h3></h3><p class="card__cat"></p>' +
    '<p class="card__dist"><svg class="icon icon--sm" width="16" height="16"><use href="#i-pin"/></svg> <span></span></p>' +
    '<a class="btn btn--sm card__view" target="_blank" rel="noopener noreferrer">View place</a>';
  wrap.querySelector("h3").textContent = place.name;
  const cat = wrap.querySelector(".card__cat");
  cat.textContent = place.typeLabel;
  cat.style.setProperty("--c", PLACE_COLORS[place.category]);
  const dist = wrap.querySelector(".card__dist");
  if (Number.isFinite(place.distance)) dist.querySelector("span").textContent = formatDistance(place.distance);
  else dist.remove(); // distance not available
  const link = wrap.querySelector(".card__view");
  link.href = "https://www.openstreetmap.org/" + place.osmType + "/" + place.osmId;
  link.setAttribute("aria-label", "View " + place.name + " on OpenStreetMap");
  return wrap;
}

function drawPlaces(places) {
  placeLayer.clearLayers();
  placeMarkers = [];
  places.forEach((place) => {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return; // skip anything without coordinates
    const marker = L.marker([place.lat, place.lng], { icon: makePlaceIcon(place.category), title: place.name, riseOnHover: true });
    marker.bindPopup(makePopup(place), { autoPanPadding: [20, 20] });
    placeMarkers.push({ category: place.category, marker });
  });
  applyMapFilter(activeFilter());
}

function activeFilter() {
  const chip = document.querySelector(".chip.is-active");
  return chip ? chip.dataset.filter : "all";
}

// Show only the markers of the selected category (All shows everything). No data is fetched.
function applyMapFilter(category) {
  if (!leafletMap) return;
  placeMarkers.forEach((item) => {
    if (category === "all" || item.category === category) placeLayer.addLayer(item.marker);
    else placeLayer.removeLayer(item.marker);
  });
  updateMapMessage();
}

// Draws the user and the places, but only when they changed. Returns true if anything was redrawn.
function syncMapData() {
  let changed = false;
  if (appState.location && drawnLocation !== appState.location) {
    drawUser(appState.location);
    drawnLocation = appState.location;
    changed = true;
  }
  if (drawnPlaces !== appState.places) {
    drawPlaces(appState.places);
    drawnPlaces = appState.places;
    changed = true;
  }
  updateMapMessage();
  return changed;
}

function fitMapToData() {
  if (!leafletMap) return;
  const bounds = L.latLngBounds([]);
  placeLayer.getLayers().forEach((marker) => bounds.extend(marker.getLatLng()));
  if (appState.location) bounds.extend([appState.location.lat, appState.location.lng]);
  if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: !reduceMotion });
}

function locateMe() {
  const loc = appState.location;
  if (!leafletMap || !loc) { updateMapMessage(); return; }
  leafletMap.setView([loc.lat, loc.lng], Math.max(leafletMap.getZoom(), 15), { animate: !reduceMotion });
}

function openMapView() {
  if (!mapView) return;
  reopenMapAt = 0;
  if (typeof closeProfile === "function") closeProfile(true);
  mapView.hidden = false;
  document.body.classList.add("map-open");
  setNavActive("map");
  if (!initMap()) return;
  const changed = syncMapData();
  leafletMap.invalidateSize(); // the container was hidden, so tell Leaflet its real size
  if (changed) fitMapToData();
}

function closeMapView(keepNav) {
  if (!mapView) return;
  mapView.hidden = true;
  document.body.classList.remove("map-open");
  if (!keepNav) setNavActive("home");
}

// No location yet: go back, run the normal Find My Location flow, and reopen the map when places arrive
function findFromMap() {
  const findBtn = document.getElementById("find-location");
  if (!findBtn) return;
  reopenMapAt = Date.now();
  closeMapView();
  window.scrollTo(0, 0);
  findBtn.click();
}

// Called every time a nearby-places request finishes
function onPlacesChanged() {
  if (reopenMapAt && Date.now() - reopenMapAt < 60000) {
    openMapView();
  } else if (leafletMap && mapView && !mapView.hidden) {
    if (syncMapData()) fitMapToData();
  }
}

// Buttons and shortcuts (each listener is added only once, here)
document.querySelectorAll("[data-open-map]").forEach((btn) => btn.addEventListener("click", openMapView));
const mapBack = document.getElementById("map-back");
if (mapBack) mapBack.addEventListener("click", () => closeMapView());
const mapLocate = document.getElementById("map-locate");
if (mapLocate) mapLocate.addEventListener("click", locateMe);
const mapFit = document.getElementById("map-fit");
if (mapFit) mapFit.addEventListener("click", fitMapToData);
if (mapMsgBtn) mapMsgBtn.addEventListener("click", () => { if (msgAction) msgAction(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mapView && !mapView.hidden) closeMapView();
});
