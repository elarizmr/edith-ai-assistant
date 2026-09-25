import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI .env.local faylında təyin olunmayıb");
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Development rejimində hot-reload zamanı çoxlu bağlantı açılmasının qarşısını alır
if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db("jarvis"); // DB adını istədiyin kimi dəyiş
}

export default clientPromise;