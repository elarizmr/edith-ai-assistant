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
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "newer_than:1d",
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];

  // Mesajların detalını paralel çək (ardıcıl döngüdən daha sürətlidir)
  const emails = await Promise.all(
    messages
      .filter((msg) => msg.id)
      .map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = detail.data.payload?.headers || [];

        return {
          id: msg.id!,
          from: getHeader(headers, "From"),
          subject: getHeader(headers, "Subject"),
          snippet: detail.data.snippet || "",
          date: getHeader(headers, "Date"),
        } as EmailSummary;
      })
  );

  return emails;
}

// System prompt-a əlavə ediləcək mətn
export async function getTodayEmailsContext(): Promise<string> {
  try {
    const emails = await getTodayEmails(10);
    console.log(`📧 Gmail: ${emails.length} email tapıldı`);

    if (emails.length === 0) {
      return "\nBu gün Elarizin gmail qutusuna yeni email gəlməyib.\n";
    }

    const lines = emails
      .map((e) => `- ${e.from} — "${e.subject}": ${e.snippet}`)
      .join("\n");

    return `\nElarizin bugün gələn emailləri:\n${lines}\n`;
  } catch (error: any) {
    console.error("Gmail oxuma xətası:", error.message);

    if (String(error.message).includes("invalid_grant")) {
      return "\nGmail-ə qoşulmaq mümkün olmadı: giriş tokeni bitib (invalid_grant). Elariz tokeni yeniləməlidir. Mailləri oxuya bilmədiyini bu səbəblə izah et, məzmun uydurma.\n";
    }

    return `\nGmail-ə qoşulmaq mümkün olmadı (texniki xəta: ${error.message}). Mailləri oxuya bilmədiyini bu səbəblə izah et, məzmun uydurma.\n`;
  }
}