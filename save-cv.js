require("dotenv").config({ path: ".env.local" });
const { MongoClient } = require("mongodb");
const fs = require("fs");

(async () => {
  const cv = fs.readFileSync("cv.txt", "utf8").trim();
  if (!cv) throw new Error("cv.txt boşdur");

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  await client.db("jarvis").collection("profile").updateOne(
    { _id: "main" },
    { $set: { cv, updatedAt: new Date() } },
    { upsert: true }
  );
  await client.close();
  console.log("CV yazıldı:", cv.length, "simvol");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});