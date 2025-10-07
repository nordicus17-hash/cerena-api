export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_KEY) return res.status(500).json({ error: "GOOGLE_MAPS_API_KEY não configurada" });

  try {
    let { lat, lng, city, state, radius = "5000", types = "", open_now, public_only, free_only, q, limit = "30" } = req.query;

    const radiusNum = Math.max(100, parseInt(radius, 10) || 5000);
    const limitNum  = Math.min(60, Math.max(1, parseInt(limit, 10) || 30));
    const openNow   = String(open_now).toLowerCase() === "true";
    const onlyPublic= String(public_only).toLowerCase() === "true";
    const onlyFree  = String(free_only).toLowerCase() === "true";

    let latNum = lat ? parseFloat(lat) : null;
    let lngNum = lng ? parseFloat(lng) : null;

    // Se não vier lat/lng, usa cidade/estado
    if ((!latNum || !lngNum) && city && state) {
      const loc = await geocodeCityState(city, state, GOOGLE_KEY);
      if (loc) { latNum = loc.lat; lngNum = loc.lng; }
    }
    if (!latNum || !lngNum) return res.status(400).json({ error: "Informe lat/lng ou city/state." });

    const typeList = String(types).split(",").map(t => t.trim()).filter(Boolean);
    let items = [];

    for (const t of typeList) {
      const { nearbyType, textQuery } = googleSearchParamsFor(t);
      const a = await googleNearbySearch({ lat:latNum, lng:lngNum, radius:radiusNum, nearbyType, open_now: openNow, key: GOOGLE_KEY });
      items = items.concat(a);

      if (textQuery) {
        for (const term of textQuery.split("|")) {
          const b = await googleTextSearch({ lat:latNum, lng:lngNum, radius:radiusNum, query: term, key: GOOGLE_KEY });
          items = items.concat(b);
        }
      }
    }

    if (q) {
      const extra = await googleTextSearch({ lat:latNum, lng:lngNum, radius:radiusNum, query: q, key: GOOGLE_KEY });
      items = items.concat(extra);
    }

    // Remove duplicados
    items = uniqBy(items, i => i.id);

    // Filtros simples
    if (onlyPublic) items = items.filter(i => /posto de sa[uú]de|ubs|caps|hospital/i.test(i.name));
    if (onlyFree)   items = items.filter(i => i.is_free === true);

    items = items.slice(0, limitNum);
    return res.status(200).json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno" });
  }
}

// ---------- Helpers ----------
async function geocodeCityState(city, state, key) {
  const addr = encodeURIComponent(`${city}, ${state}, Brasil`);
  const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&key=${key}`;
  const r = await fetch(url); const d = await r.json();
  const loc = d?.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}
function uniqBy(arr, fn){ const s=new Set(); const out=[]; for(const v of arr){ const k=fn(v); if(!s.has(k)){ s.add(k); out.push(v);} } return out; }
function normalizePlace(p){
  return {
    id:`g:${p.place_id}`, source:"google", name:p.name||"", types:p.types||[],
    phone:null, whatsapp:null, website:p.website||null,
    address:p.vicinity||p.formatted_address||"",
    location:{ lat:p.geometry?.location?.lat, lng:p.geometry?.location?.lng },
    open_now:p.opening_hours?.open_now ?? null, price:"desconhecido",
    is_public:false, is_free:false, rating:p.rating ?? null,
    meta:{ place_id:p.place_id, maps_url: p.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}` : null }
  };
}
function googleSearchParamsFor(type){
  switch(type){
    case "psychologist": return { nearbyType:"psychologist", textQuery:null };
    case "psychiatrist": return { nearbyType:"doctor", textQuery:"psiquiatra" };
    case "clinic": return { nearbyType:"clinic", textQuery:null };
    case "hospital": return { nearbyType:"hospital", textQuery:null };
    case "caps": return { nearbyType:"hospital", textQuery:"CAPS" };
    case "group": return { nearbyType:"church", textQuery:"Alcoólicos Anônimos|Narcóticos Anônimos|AA|NA" };
    default: return { nearbyType:null, textQuery:null };
  }
}
async function googleNearbySearch({ lat, lng, radius, nearbyType, open_now, key }){
  if(!nearbyType) return [];
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${nearbyType}${open_now?`&opennow=true`:``}&key=${key}`;
  const r = await fetch(url); const d = await r.json();
  return (d.results||[]).map(normalizePlace);
}
async function googleTextSearch({ lat, lng, radius, query, key }){
  if(!query) return [];
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${key}`;
  const r = await fetch(url); const d = await r.json();
  return (d.results||[]).map(normalizePlace);
}
