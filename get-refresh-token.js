// BİR DƏFƏLİK işlədilən script: Gmail və Calendar üçün refresh token almaq.
// İşlətmək: node get-refresh-token.js
// (əvvəlcə: npm install googleapis dotenv)

require("dotenv").config({ path: ".env.local" });
const { google } = require("googleapis");
const http = require("http");
const url = require("url");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ .env.local-da GOOGLE_CLIENT_ID və GOOGLE_CLIENT_SECRET tapılmadı");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // refresh token almaq üçün MÜTLƏQ lazımdır
  prompt: "consent", // hər dəfə yeni refresh token verməsi üçün
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly", // maillərı oxumaq
    "https://www.googleapis.com/auth/calendar", // təqvimi oxumaq və yazmaq
  ],
});

console.log("\n👉 Bu linki brauzerdə aç və Gmail-i oxuyacaq hesabı seç:\n");
console.log(authUrl);
console.log("\nGözlənilir...\n");

const server = http
  .createServer(async (req, res) => {
    const parsed = new url.URL(req.url, `http://localhost:${PORT}`);

    // favicon və s. kənar sorğuları ignor et
    if (parsed.pathname !== "/oauth2callback") {
      res.statusCode = 404;
      res.end();
      return;
    }

    const error = parsed.searchParams.get("error");
    if (error) {
      res.end(`Xəta: ${error}. Terminala bax.`);
      console.error(`❌ Google xəta qaytardı: ${error}`);
      server.close();
      return;
    }

    const code = parsed.searchParams.get("code");
    if (!code) {
      res.end("Xəta: kod tapılmadı.");
      return;
    }

    res.end("✅ Uğurlu oldu! Terminala qayıda bilərsən, bu pəncərəni bağlaya bilərsən.");
    server.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        console.error(
          "\n⚠️ Refresh token gəlmədi. Bu hesab bu tətbiqə əvvəl icazə verib.\n" +
            "myaccount.google.com/permissions səhifəsindən Jarvis-i sil və skripti yenidən işlət.\n"
        );
        return;
      }

      console.log("\n🎉 REFRESH TOKEN ALINDI.\n");
      console.log("Bunu .env.local-a yaz (köhnə GOOGLE_REFRESH_TOKEN sətrini əvəz et):\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    } catch (err) {
      console.error("❌ Token alınarkən xəta:", err.message);
    }
  })
  .listen(PORT, () => {
    console.log(`Lokal server ${PORT} portunda gözləyir (Google-un geri qayıtması üçün)...`);
  });