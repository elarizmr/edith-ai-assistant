import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();
  const jobs = await db.collection("jobs")
    .find({ status: { $in: ["new", "draft", "pending_approval"] } })
    .sort({ score: -1 }).limit(20).toArray();
  return NextResponse.json(jobs);
}