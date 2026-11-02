import { NextResponse } from "next/server";
import { searchPlaces, isLead, saveLeads } from "@/lib/leads";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "bərbərxana";
  const city = searchParams.get("city") ?? "Bakı";

  const places = await searchPlaces(category, city);
  const rawLeads = places.filter(isLead);

  const saved =
    searchParams.get("save") === "1"
      ? await saveLeads(rawLeads, category, city)
      : null;

  const leads = rawLeads.map((p: any) => ({
    name: p.displayName?.text,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
    website: p.websiteUri ?? null,
    mapsUrl: p.googleMapsUri,
  }));

  return NextResponse.json({
    total: places.length,
    leads: leads.length,
    saved,
    data: leads,
  });
}