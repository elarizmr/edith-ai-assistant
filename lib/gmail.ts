import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

function getHeader(headers: any[], name: string): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

// Bugün gələn emailləri gətir
export async function getTodayEmails(maxResults = 10): Promise<EmailSummary[]> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log(`📧 Autentifikasiya olunan Gmail hesabı: ${profile.data.emailAddress}`);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `newer_than:1d`,
    maxResults,
  });

  console.log(`📧 Gmail sorğusu: newer_than:1d — xam nəticə sayı: ${listRes.data.messages?.length || 0}`);

  // MÜVƏQQƏTİ TEST: heç bir filtr olmadan cəmi neçə mesaj var?
  const testRes = await gmail.users.messages.list({ userId: "me", maxResults: 5 });
  console.log(`🧪 TEST (filtrsiz) nəticə sayı: ${testRes.data.messages?.length || 0}, resultSizeEstimate: ${testRes.data.resultSizeEstimate}`);

  // MÜVƏQQƏTİ TEST 2: bu mesajların həqiqi tarixi nədir?
  if (testRes.data.messages && testRes.data.messages.length > 0) {
    for (const m of testRes.data.messages.slice(0, 3)) {
      const d = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Date", "Subject"],
      });
      const dateHeader = d.data.payload?.headers?.find((h) => h.name === "Date")?.value;
      const subjHeader = d.data.payload?.headers?.find((h) => h.name === "Subject")?.value;
      console.log(`🧪 TEST mesaj — internalDate: ${d.data.internalDate}, Date header: ${dateHeader}, Subject: ${subjHeader}`);
    }
  }

  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];

  const emails: EmailSummary[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = detail.data.payload?.headers || [];

    emails.push({
      id: msg.id,
      from: getHeader(headers, "From"),
      subject: getHeader(headers, "Subject"),
      snippet: detail.data.snippet || "",
      date: getHeader(headers, "Date"),
    });
  }

  return emails;
}

// System prompt-a əlavə ediləcək mətn formatı
export async function getTodayEmailsContext(): Promise<string> {
  try {
    const emails = await getTodayEmails(10);
    console.log(`📧 Gmail: ${emails.length} email tapıldı bugün üçün`);
    if (emails.length === 0) {
      return "\nBu gün Elarizin gmail qutusuna yeni email gəlməyib.\n";
    }

    const lines = emails
      .map((e) => `- ${e.from} — "${e.subject}": ${e.snippet}`)
      .join("\n");

    return `\nElarizin bugün gələn emailləri:\n${lines}\n`;
  } catch (error: any) {
    console.error("Gmail oxuma xətası:", error.message);
    return "";
  }
}
