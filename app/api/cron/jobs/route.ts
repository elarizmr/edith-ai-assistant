import { NextRequest, NextResponse } from "next/server";
import { runDailyJobSearch } from "@/lib/daily";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await runDailyJobSearch();
  return NextResponse.json(result);
}