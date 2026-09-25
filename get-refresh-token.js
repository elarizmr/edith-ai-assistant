// Bu, BİR DƏFƏLİK işlədiləcək scriptdir — refresh token almaq üçün.
// İşlətmək: node get-refresh-token.js
// (əvvəlcə: npm install googleapis dotenv)

require("dotenv").config({ path: ".env.local" });
const { google } = require("googleapis");
const http = require("http");
const url = require("url");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3001/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ .env.local-da GOOGLE_CLIENT_ID və GOOGLE_CLIENT_SECRET tapılmadı");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // refresh token almaq üçün MÜTLƏQ lazımdır
  prompt: "consent", // hər dəfə yeni refresh token vermək üçün
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly", // yalnız oxumaq üçün
  ],
});

console.log("\n👉 Bu linki brauzerdə aç və Google hesabına icazə ver:\n");
console.log(authUrl);
console.log("\nGözlənilir...\n");

const server = http
  .createServer(async (req, res) => {
    const qs = new url.URL(req.url, "http://localhost:3001").searchParams;
    const code = qs.get("code");

    if (!code) {
      res.end("Xəta: kod tapılmadı.");
      return;
    }

    res.end("✅ Uğurlu oldu! Terminala qayıda bilərsən, pəncərəni bağlaya bilərsən.");
    server.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log("\n🎉 REFRESH TOKEN ALINDI:\n");
      console.log(tokens.refresh_token);
      console.log("\nBunu .env.local-a əlavə et:");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    } catch (err) {
      console.error("❌ Token alınarkən xəta:", err.message);
    }
  })
  .listen(3001, () => {
    console.log("Lokal server 3001 portunda gözləyir (Google-un geri qayıtması üçün)...");
  });