import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "./mongodb";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MIN_SCORE = 70;
const MAX_NEW_PER_RUN = 30;

type RawJob = {
  jobId: string;
  source: string;
  title: string;
  company: string;
  url: string;
  description: string;
  tags: string[];
};

const stripHtml = (s: string) => String(s || "").replace(/<[^>]*>/g, " ");

async function getCv(): Promise<string> {
  const db = await getDb();
  const p = await db.collection("profile").findOne({ _id: "main" as any });
  if (!p?.cv) throw new Error("CV tapılmadı. profile kolleksiyasına cv mətni əlavə et.");
  return p.cv;
}

async function scoreJob(cv: string, title: string, company: string, desc: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.8-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const res = await model.generateContent(
    `CV:\n${cv}\n\nElan: ${title} - ${company}\n${stripHtml(desc).slice(0, 4000)}\n\n` +
      `Bu elanın CV-yə uyğunluğunu qiymətləndir. Namizəd junior səviyyədədir: ` +
      `junior, entry-level, intern və 0-2 il təcrübə tələb edən elanlara yüksək bal ver, ` +
      `3+ il təcrübə tələb edən senior elanlara aşağı bal ver. ` +
      `Yalnız JSON qaytar: {"score": 0-100, "reason": "bir cümlə"}`
  );
  const parsed = JSON.parse(res.response.text());
  const score = Number(parsed.score);
  if (!Number.isFinite(score)) throw new Error("bad score");
  return { score, reason: String(parsed.reason || "") };
}

// ---------- MƏNBƏLƏR ----------

async function fromRemotive(query: string): Promise<RawJob[]> {
  const r = await fetch(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error(`Remotive ${r.status}`);
  const { jobs } = await r.json();
  return (jobs || []).map((j: any) => ({
    jobId: `remotive-${j.id}`,
    source: "remotive",
    title: j.title,
    company: j.company_name,
    url: j.url,
    description: j.description,
    tags: j.tags || [],
  }));
}

async function fromRemoteOk(): Promise<RawJob[]> {
  const r = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "Mozilla/5.0 Jarvis" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`RemoteOK ${r.status}`);
  const data = await r.json();
  return (Array.isArray(data) ? data : [])
    .filter((j: any) => j && j.id && j.position)
    .map((j: any) => ({
      jobId: `remoteok-${j.id}`,
      source: "remoteok",
      title: j.position,
      company: j.company,
      url: j.url || j.apply_url,
      description: j.description || "",
      tags: j.tags || [],
    }));
}

async function fromArbeitnow(): Promise<RawJob[]> {
  const r = await fetch("https://www.arbeitnow.com/api/job-board-api", { cache: "no-store" });
  if (!r.ok) throw new Error(`Arbeitnow ${r.status}`);
  const { data } = await r.json();
  return (data || [])
    .filter((j: any) => j.remote)
    .map((j: any) => ({
      jobId: `arbeitnow-${j.slug}`,
      source: "arbeitnow",
      title: j.title,
      company: j.company_name,
      url: j.url,
      description: j.description || "",
      tags: j.tags || [],
    }));
}

// ---------- SÜZGƏC ----------

function matchesQuery(j: RawJob, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${j.title} ${j.tags.join(" ")}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

// ---------- ƏSAS FUNKSİYA ----------

export async function findJobs(query: string) {
  const db = await getDb();
  const col = db.collection("jobs");
  const cv = await getCv();

  const results = await Promise.allSettled([fromRemotive(query), fromRemoteOk(), fromArbeitnow()]);
  const names = ["remotive", "remoteok", "arbeitnow"];
  let all: RawJob[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`📥 ${names[i]}: ${r.value.length} elan`);
      all = all.concat(r.value);
    } else {
      console.error(`❌ ${names[i]} xətası:`, r.reason?.message);
    }
  });

  all = all.filter((j) => matchesQuery(j, query));

  // artıq bazada olanları at
  const fresh: RawJob[] = [];
  for (const j of all) {
    if (fresh.length >= MAX_NEW_PER_RUN) break;
    if (fresh.some((f) => f.jobId === j.jobId)) continue;
    if (await col.findOne({ jobId: j.jobId })) continue;
    fresh.push(j);
  }
  console.log(`🆕 Yeni elan: ${fresh.length}`);

  let added = 0;
  for (let i = 0; i < fresh.length; i += 5) {
    const batch = fresh.slice(i, i + 5);
    const scored = await Promise.all(
      batch.map(async (j) => {
        try {
          return { j, ...(await scoreJob(cv, j.title, j.company, j.description)) };
        } catch (err: any) {
          console.error(`❌ Qiymətləndirmə xətası (${j.title}):`, err?.message);
          return null;
        }
      })
    );
    for (const s of scored) {
      if (!s) continue;
      const { j, score, reason } = s;
      await col.insertOne({
        jobId: j.jobId,
        source: j.source,
        title: j.title,
        company: j.company,
        url: j.url,
        description: j.description,
        applyEmail:
          stripHtml(j.description).match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null,
        score,
        reason,
        status: score >= MIN_SCORE ? "new" : "skipped",
        createdAt: new Date(),
      });
      if (score >= MIN_SCORE) added++;
    }
  }
  return added;
}