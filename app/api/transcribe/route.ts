import { NextRequest, NextResponse } from "next/server";

// BCP-47 → ElevenLabs ISO-639-3 xəritəsi
const LANG_MAP: Record<string, string> = {
  "tr-TR": "tur",
  "en-US": "eng",
  "az-AZ": "aze",
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API Key tapılmadı." },
        { status: 500 }
      );
    }

    const incomingFormData = await req.formData();
    const audioFile = incomingFormData.get("audio") as File | null;
    const lang = (incomingFormData.get("lang") as string) || "tr-TR";

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio fayl tapılmadı." },
        { status: 400 }
      );
    }

    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append("file", audioFile);
    elevenLabsFormData.append("model_id", "scribe_v1");

    const languageCode = LANG_MAP[lang];
    if (languageCode) {
      elevenLabsFormData.append("language_code", languageCode);
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: elevenLabsFormData,
      }
    );

    if (!response.ok) {
      const errData = await response.text();
      console.error("ElevenLabs STT Error:", errData);
      return NextResponse.json(
        { error: "ElevenLabs STT API xətası" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text || "" });
  } catch (error) {
    console.error("Transcribe route error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}