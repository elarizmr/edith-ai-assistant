import { NextRequest, NextResponse } from "next/server";

// Sürətli model. Azərbaycan dili keyfiyyətsiz oxunarsa .env.local-da
// ELEVENLABS_MODEL_ID=eleven_turbo_v2_5 (və ya eleven_multilingual_v2) yazın.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API Key tapılmadı." },
        { status: 500 }
      );
    }

    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    if (!VOICE_ID) {
      return NextResponse.json(
        { error: "ELEVENLABS_VOICE_ID tapılmadı." },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "Mətn daxil edilməyib." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok || !response.body) {
      const errData = await response.text();
      console.error("ElevenLabs TTS Error:", errData);
      return NextResponse.json(
        { error: "ElevenLabs TTS xətası" },
        { status: response.status || 500 }
      );
    }

    // Buferə yığmadan birbaşa ötürürük
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Speak route error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}