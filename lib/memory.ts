import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

export interface Memory {
  _id?: ObjectId;
  userId: string;
  type: "fact" | "preference" | "note";
  content: string;
  createdAt: Date;
}

export async function addMemory(
  userId: string,
  content: string,
  type: Memory["type"] = "fact"
) {
  const db = await getDb();
  const result = await db.collection<Memory>("memories").insertOne({
    userId,
    type,
    content,
    createdAt: new Date(),
  });
  return result.insertedId;
}

export async function getMemories(userId: string, limit = 50) {
  const db = await getDb();
  return db
    .collection<Memory>("memories")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

// System prompt-a əlavə ediləcək mətn formatı
export async function getMemoryContext(userId: string): Promise<string> {
  const memories = await getMemories(userId);
  if (memories.length === 0) return "";

  const lines = memories.map((m) => `- ${m.content}`).join("\n");
  return `\nƏvvəldən bildiyin faktlar (Elariz haqqında):\n${lines}\n`;
}

export async function deleteMemory(id: string) {
  const db = await getDb();
  return db.collection<Memory>("memories").deleteOne({ _id: new ObjectId(id) });
}