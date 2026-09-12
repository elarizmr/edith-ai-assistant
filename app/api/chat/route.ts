import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { toolDeclarations, executeTool } from "@/lib/system-tools";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildSystemPrompt(lang: string) {
  return `
You are E.D.I.T.H., a personal AI assistant.
The user's name is Elariz. Always address him by his name, "Elariz",
naturally within your responses (like Jarvis calling Tony Stark "sir",
but using the name "Elariz" instead). Use his name in every language.

CRITICAL LANGUAGE RULE — READ CAREFULLY:
The current required response language is: ${lang}

- If lang is 'tr-TR': respond strictly in Turkish (Türkçe). Example greeting: "Merhaba Elariz, nasıl yardımcı olabilirim?"
- If lang is 'en-US': respond strictly in English. Example greeting: "Hello Elariz, how can I help?"
- If lang is 'az-AZ': respond strictly in AZERBAIJANI (Azərbaycan dili), NOT Turkish. These are different languages with different spelling and words (e.g. Azerbaijani "necəsən", "təşəkkür edirəm", "kömək edə bilərəmmi" vs Turkish "nasılsın", "teşekkür ederim", "yardımcı olabilir miyim"). Example greeting: "Salam Elariz, sizə necə kömək edə bilərəm?"

Do not default to Turkish when lang is 'az-AZ'. Ignore the language used in earlier conversation history if it differs from the current lang value above — always follow the CURRENT lang, every single turn.

You have the capability to execute system tools on the user's computer (open apps, search files, run scripts, adjust volume, etc.).
When a user command requires system interaction, call the appropriate tool. For general questions, respond directly.
Keep your responses short, concise, and natural for text-to-speech.
`;
}

// Kiçik modellər (gemini-3.5-flash-lite) system instruction-a nisbətən
// cari user mesajına daha çox əməl edir. Ona görə hər mesaja əlavə
// bir dil xatırlatması "hint" kimi əlavə edirik ki, model konuşma
// tarixçəsindən (əvvəlki dil) təsirlənib "yadına düşməsin".
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

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: buildSystemPrompt(lang),
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
      if (!functionCalls || functionCalls.length === 0) break;

      // Modelin function-call cavabını "model" rolu ilə tarixçəyə əlavə et
      const modelParts =
        response.candidates?.[0]?.content?.parts ||
        functionCalls.map((fc) => ({ functionCall: fc }));

      contents.push({ role: "model", parts: modelParts as any });

      // Function nəticələrini "user" rolu ilə əlavə et (Gemini bunu belə gözləyir)
      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        try {
          const toolResult = await executeTool(call.name, call.args);
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

    // Tarixçəyə orijinal mesajı (dil hint-i olmadan) yazırıq ki,
    // saxlanan tarixçə təmiz qalsın.
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
      { error: error?.message || "E.D.I.T.H. encountered an error." },
      { status: 500 }
    );
  }
}