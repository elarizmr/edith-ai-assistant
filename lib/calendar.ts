import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

export interface EVEvent {
  _id?: ObjectId;
  userId: string;
  title: string;
  description?: string;
  date: Date;
  createdAt: Date;
}

export async function addEvent(
  userId: string,
  title: string,
  date: Date,
  description?: string
) {
  const db = await getDb();
  const result = await db.collection<EVEvent>("events").insertOne({
    userId,
    title,
    description,
    date,
    createdAt: new Date(),
  });
  return result.insertedId;
}

export async function getTodayEvents(userId: string) {
  const db = await getDb();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return db
    .collection<EVEvent>("events")
    .find({ userId, date: { $gte: start, $lte: end } })
    .sort({ date: 1 })
    .toArray();
}

// System prompt-a əlavə ediləcək mətn formatı
export async function getTodayEventsContext(userId: string): Promise<string> {
  const events = await getTodayEvents(userId);
  if (events.length === 0) return "\nBu gün Elarizin planında heç nə qeyd olunmayıb.\n";

  const lines = events
    .map((e) => {
      const time = e.date.toLocaleTimeString("az-AZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `- ${time} — ${e.title}${e.description ? ` (${e.description})` : ""}`;
    })
    .join("\n");

  return `\nElarizin bugünkü planı:\n${lines}\n`;
}

export async function deleteEvent(id: string) {
  const db = await getDb();
  return db.collection<EVEvent>("events").deleteOne({ _id: new ObjectId(id) });
}