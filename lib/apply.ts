import { google } from "googleapis";
import { readFile } from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "./mongodb";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const stripHtml = (s: string) => String(s || "").replace(/<[^>]*>/g, " ");

async function writeCoverLetter(cv: string, title: string, company: string, desc: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
  const res = await model.generateContent(
    `CV:\n${cv}\n\nJob: ${title} - ${company}\n${stripHtml(desc).slice(0, 3000)}\n\n` +
      `Write a short (150 words) English cover letter for this job. ` +
      `Use ONLY experience and skills from the CV, invent nothing.`
  );
  return res.response.text();
}

// Ən yüksək ballı, hələ toxunulmamış elanı götür və məktub yaz
export async function prepareNextApplication() {
  const db = await getDb();
  const job = await db.collection("jobs").find({ status: "new" }).sort({ score: -1 }).limit(1).next();
  if (!job) return null;
  const profile = await db.collection("profile").findOne({ _id: "main" as any });

  const coverLetter = await writeCoverLetter(profile?.cv, job.title, job.company, job.description);

  await db.collection("jobs").updateOne(
    { _id: job._id },
    { $set: { status: "draft", coverLetter } }
  );
  return { title: job.title, company: job.company, url: job.url, score: job.score, coverLetter };
}

// Yalnız elanda email olanda işlət
export async function sendApplicationEmail(to: string, subject: string, body: string) {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth });

  const cv = (await readFile(process.env.CV_PDF_PATH!))
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  const boundary = "jarvis-boundary";
  const raw = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
    "",
    `--${boundary}`,
    'Content-Type: application/pdf; name="CV.pdf"',
    'Content-Disposition: attachment; filename="CV.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    cv,
    `--${boundary}--`,
  ].join("\r\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(raw).toString("base64url") },
  });
}

// 70+ balı, emaili olan bütün yeni elanlar üçün məktub hazırla (göndərmir)
export async function prepareAllApplications() {
  const db = await getDb();
  const profile = await db.collection("profile").findOne({ _id: "main" as any });
  const jobs = await db.collection("jobs")
    .find({ status: "new", applyEmail: { $ne: null } })
    .sort({ score: -1 }).limit(10).toArray();

  const out: string[] = [];
  for (const job of jobs) {
    const coverLetter = await writeCoverLetter(profile?.cv, job.title, job.company, job.description);
    await db.collection("jobs").updateOne(
      { _id: job._id },
      { $set: { status: "pending_approval", coverLetter } }
    );
    out.push(`${job.company} (${job.title}, bal ${job.score})`);
  }
  return out;
}

// Təsdiq gözləyənləri göndər
export async function sendApprovedApplications() {
  const db = await getDb();
  const jobs = await db.collection("jobs")
    .find({ status: "pending_approval" }).limit(10).toArray();
  const sent: string[] = [];
  for (const job of jobs) {
    try {
      await sendApplicationEmail(job.applyEmail, `Application: ${job.title}`, job.coverLetter);
      await db.collection("jobs").updateOne(
        { _id: job._id }, { $set: { status: "sent", sentAt: new Date() } }
      );
      sent.push(job.company);
    } catch (err: any) {
      console.error(`❌ Göndərmə xətası (${job.company}):`, err?.message);
      await db.collection("jobs").updateOne({ _id: job._id }, { $set: { status: "send_failed" } });
    }
  }
  return sent;
}