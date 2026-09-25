import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { toolDeclarations, executeTool, USER_ID } from "@/lib/system-tools";
import { getMemoryContext } from "@/lib/memory";
import { getTodayEventsContext } from "@/lib/calendar";
import { getTodayEmailsContext } from "@/lib/gmail";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildSystemPrompt(
  lang: string,
  memoryContext: string,
  todayContext: string,
  emailContext: string
) {
  const now = new Date();
  const currentDateStr = now.toISOString(); // məs: 2026-09-13T18:42:00.000Z
  const currentDateReadable = now.toLocaleDateString("az-AZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return `
You are J.A.R.V.I.S, a personal AI assistant.

CURRENT REAL DATE AND TIME: ${currentDateStr} (${currentDateReadable})
Always use THIS exact date as "today" — never guess or assume a different year.
When Elariz mentions a date without a year (e.g. "13 oktyabr"), calculate the ISO date
using the CURRENT YEAR shown above, unless that date has already passed this year,
in which case use next year instead.

The user's name is Elariz. Address him casually using "Patron" (a friendly
boss-style nickname) instead of formal titles — like a close friend who
jokingly calls him "patron". Use the equivalent word in each language:
- Turkish: "Patron"
- English: "Boss" or "Patron"
- Azerbaijani: "Patron"
You can also use his name "Elariz" naturally sometimes, mixed with "Patron".

TONE: Speak warmly and casually, like a close friend — NOT stiff or formal.
Always use the INFORMAL "sen/sən" form (never the formal "siz") in every
language. Light humor and a relaxed, friendly register are welcome. Avoid
robotic or corporate-sounding phrasing (no "How may I assist you today?"
style formality).

CRITICAL LANGUAGE RULE — READ CAREFULLY:
The current required response language is: ${lang}

- If lang is 'tr-TR': respond strictly in Turkish (Türkçe), informal "sen" form, samimi bir tonda. Example greeting: "Selam Patron! Naber, ne yapıyoruz bugün?"
- If lang is 'en-US': respond strictly in English, warm and casual tone. Example greeting: "Hey boss! What's up, what can I do for you?"
- If lang is 'az-AZ': respond strictly in AZERBAIJANI (Azərbaycan dili), NOT Turkish, informal "sən" form, səmimi bir tonda. These are different languages with different spelling and words (e.g. Azerbaijani "necəsən", "təşəkkür edirəm", "kömək edə bilərəmmi" vs Turkish "nasılsın", "teşekkür ederim", "yardımcı olabilir miyim"). Example greeting: "Salam Patron! Necəsən, nə var nə yox?"

Do not default to Turkish when lang is 'az-AZ'. Ignore the language used in earlier conversation history if it differs from the current lang value above — always follow the CURRENT lang, every single turn.

You have the capability to execute system tools on the user's computer (open apps, search files, run scripts, adjust volume, etc.).
When a user command requires system interaction, call the appropriate tool. For general questions, respond directly.

You also have long-term memory about Elariz and access to his daily schedule, shown below.
Use this information naturally when relevant — do not just repeat it verbatim unless asked.
${memoryContext}
${todayContext}
${emailContext}

If Elariz tells you something worth remembering (a fact, preference, or note about himself),
call the remember_fact tool. If he mentions a meeting, task, or event with a date/time,
call the add_calendar_event tool.

Keep your responses short, concise, and natural for text-to-speech.
`;
}

const LANG_HINT: Record<string, string> = {
  "tr-TR": "[Bu mesaja SADECE Türkçe cevap ver.] ",
  "en-US": "[Respond to this message ONLY in English.] ",
  "az-AZ": "[Bu mesaja YALNIZ Azərbaycan dilində cavab ver, türk dilində YOX.] ",
};

export async function POST(req: NextRequest) {
  try {
    const { message, lang = "tr-TR", history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message field is required" },
        { status: 400 }
      );
    }

    // Yaddaş + bugünkü planı paralel çəkirik ki, gecikmə minimal olsun
    const [memoryContext, todayContext, emailContext] = await Promise.all([
      getMemoryContext(USER_ID),
      getTodayEventsContext(USER_ID),
      getTodayEmailsContext(),
    ]);

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: buildSystemPrompt(lang, memoryContext, todayContext, emailContext),
      tools: [
        {
          functionDeclarations: toolDeclarations as any,
        },
      ],
    });

    const safeHistory: Content[] = Array.isArray(history)
      ? history
          .filter(
            (h: any) =>
              h &&
              (h.role === "user" || h.role === "model") &&
              typeof h.content === "string" &&
              h.content.trim() !== ""
          )
          .map((h: any) => ({
            role: h.role,
            parts: [{ text: h.content }],
          }))
      : [];

    const langHint = LANG_HINT[lang] || "";
    const messageWithHint = `${langHint}${message}`;

    // ---------------------------------------------------------
    // ÖZÜMÜZ İDARƏ EDİLƏN CONTENTS MASSİVİ
    // (chat.sendMessage() ƏVƏZİNƏ generateContent() istifadə edirik
    // ki, function response-un rolunu özümüz "user" kimi təyin edək,
    // SDK-nın köhnəlmiş "function" rolunu avtomatik seçməsinin qarşısını alaq)
    // ---------------------------------------------------------
    const contents: Content[] = [
      ...safeHistory,
      { role: "user", parts: [{ text: messageWithHint }] },
    ];

    let result = await model.generateContent({ contents });
    let response = result.response;

    let iterations = 0;
    while (iterations < 5) {
      const functionCalls = response.functionCalls();
      console.log("🔧 Function calls:", JSON.stringify(functionCalls, null, 2));
      if (!functionCalls || functionCalls.length === 0) {
        console.log("⚠️ Model heç bir tool çağırmadı, birbaşa mətn cavab verdi.");
        break;
      }

      const modelParts =
        response.candidates?.[0]?.content?.parts ||
        functionCalls.map((fc) => ({ functionCall: fc }));

      contents.push({ role: "model", parts: modelParts as any });

      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        try {
          console.log(`⚙️ İcra olunur: ${call.name}`, call.args);
          const toolResult = await executeTool(call.name, call.args);
          console.log(`✅ Nəticə: ${toolResult}`);
          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          });
        } catch (toolError: any) {
          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: toolError?.message || "Tool execution error" },
            },
          });
        }
      }

      contents.push({ role: "user", parts: functionResponseParts });

      result = await model.generateContent({ contents });
      response = result.response;
      iterations++;
    }

    const responseText =
      response.text() ||
      (lang === "en-US"
        ? "Sorry, I couldn't generate a response."
        : lang === "az-AZ"
        ? "Üzr istəyirəm, cavab yarada bilmədim."
        : "Üzgünüm, bir cevap oluşturamadım.");

    const updatedHistory = [
      ...safeHistory.map((h: any) => ({
        role: h.role,
        content: h.parts?.[0]?.text || "",
      })),
      { role: "user", content: message },
      { role: "model", content: responseText },
    ];

    return NextResponse.json({
      response: responseText,
      history: updatedHistory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "J.A.R.V.I.S encountered an error." },
      { status: 500 }
    );
  }
}