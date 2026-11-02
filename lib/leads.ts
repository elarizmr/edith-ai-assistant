import { getDb } from "./mongodb";

const SOCIAL = ["facebook.com", "instagram.com", "linktr.ee", "tiktok.com", "wa.me"];

const CATEGORY_FILTERS: Record<string, string[]> = {
  "bərbərxana": ['["shop"="hairdresser"]', '["shop"="barber"]'],
  "bərbər": ['["shop"="hairdresser"]', '["shop"="barber"]'],
  "gözəllik salonu": ['["shop"="beauty"]'],
  "restoran": ['["amenity"="restaurant"]'],
  "kafe": ['["amenity"="cafe"]'],
  "aptek": ['["amenity"="pharmacy"]'],
  "diş klinikası": ['["amenity"="dentist"]'],
  "avtoyuma": ['["amenity"="car_wash"]'],
  "otel": ['["tourism"="hotel"]'],
  "geyim mağazası": ['["shop"="clothes"]'],
  "avto servis": ['["shop"="car_repair"]'],
  "idman zalı": ['["leisure"="fitness_centre"]'],
};

// south, west, north, east (təxmini)
const CITY_BBOX: Record<string, string> = {
  "bakı": "40.30,49.70,40.50,50.05",
  "baku": "40.30,49.70,40.50,50.05",
  "sumqayıt": "40.55,49.60,40.65,49.74",
  "gəncə": "40.64,46.30,40.72,46.44",
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchPlaces(category: string, city: string) {
  const key = category.trim().toLowerCase();
  const filters = CATEGORY_FILTERS[key] ?? [
    `["name"~"${key.replace(/["\\]/g, "")}",i]`,
  ];
  const safeCity = city.trim().replace(/["\\]/g, "");
  const bbox = CITY_BBOX[safeCity.toLowerCase()];

  const query = bbox
    ? `[out:json][timeout:20];(${filters
        .map((f) => `nwr${f}(${bbox});`)
        .join("")});out center tags 200;`
    : `[out:json][timeout:25];area["name"="${safeCity}"]["boundary"="administrative"]->.a;(${filters
        .map((f) => `nwr(area.a)${f};`)
        .join("")});out center tags 150;`;

  let data: any = null;
  let errors: string[] = [];

  for (let round = 0; round < 2 && !data; round++) {
    if (round > 0) await sleep(4000);
    errors = [];
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "jarvis-leads/1.0",
          },
          body: "data=" + encodeURIComponent(query),
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
        errors.push(`${new URL(url).hostname} ${res.status}`);
      } catch (e: any) {
        errors.push(
          `${new URL(url).hostname} ${e.name === "TimeoutError" ? "timeout" : e.message}`
        );
      }
    }
  }

  if (!data) {
    throw new Error(
      `Xəritə serverləri cavab vermədi (${errors.join(", ")}). Bir az sonra yenidən yoxla.`
    );
  }

  return (data.elements ?? [])
    .filter((e: any) => e.tags?.name)
    .map((e: any) => {
      const t = e.tags;
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      const phone = t.phone || t["contact:phone"] || t.mobile || t["contact:mobile"];
      const site =
        t.website || t["contact:website"] || t.url ||
        t["contact:instagram"] || t["contact:facebook"] || null;
      const address = [t["addr:street"], t["addr:housenumber"], t["addr:city"]]
        .filter(Boolean)
        .join(" ");
      return {
        id: `${e.type}/${e.id}`,
        displayName: { text: t.name },
        formattedAddress: address,
        nationalPhoneNumber: phone,
        internationalPhoneNumber: phone,
        websiteUri: site,
        googleMapsUri: lat
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
          : null,
        businessStatus: "OPERATIONAL",
      };
    });
}

export function isLead(p: any) {
  const hasPhone = p.internationalPhoneNumber || p.nationalPhoneNumber;
  if (!hasPhone) return false;
  if (!p.websiteUri) return true;
  return SOCIAL.some((d) => p.websiteUri.includes(d));
}

export async function saveLeads(places: any[], category: string, city: string) {
  const db = await getDb();
  const col = db.collection("leads");
  let added = 0;
  for (const p of places) {
    const r = await col.updateOne(
      { placeId: p.id },
      {
        $setOnInsert: {
          placeId: p.id,
          name: p.displayName?.text,
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
          address: p.formattedAddress,
          category,
          city,
          website: p.websiteUri ?? null,
          mapsUrl: p.googleMapsUri,
          status: "new",
          messages: [],
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    if (r.upsertedCount) added++;
  }
  return added;
}