import { execFile } from "child_process";
import { promisify } from "util";
import { findJobs } from "./jobs";
import { prepareAllApplications } from "./apply";
import { getDb } from "./mongodb";

const execFileAsync = promisify(execFile);

const QUERIES = ["junior react frontend javascript"];
function notify(text: string) {
  const safe = text.replace(/["\\]/g, "");
  return execFileAsync("osascript", [
    "-e",
    `display notification "${safe}" with title "J.A.R.V.I.S"`,
  ]);
}

export async function runDailyJobSearch() {
  let added = 0;
  for (const q of QUERIES) {
    try {
      added += await findJobs(q);
    } catch (err: any) {
      console.error(`❌ Axtarış xətası (${q}):`, err?.message);
    }
  }

  const prepared = await prepareAllApplications(); // emaili olanlar → pending_approval

  const db = await getDb();
  const noEmail = await db.collection("jobs").countDocuments({ status: "new", applyEmail: null });

  const parts: string[] = [];
  if (prepared.length) parts.push(`${prepared.length} müraciət təsdiq gözləyir: ${prepared.join(", ")}`);
  if (noEmail) parts.push(`${noEmail} uyğun elanda email yoxdur (linklə müraciət)`);
  if (!parts.length) parts.push("Bu gün yeni uyğun elan tapılmadı");

  const summary = parts.join(". ");
  await notify(summary.slice(0, 200));
  return { added, prepared, noEmail };
}