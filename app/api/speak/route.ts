import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API Key tapılmadı." },
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

    // ElevenLabs Voice ID (məsələn: Rachel, Adam və ya öz xüsusi səs ID-niz)
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.text();
      console.error("ElevenLabs TTS Error:", errData);
      return NextResponse.json(
        { error: "ElevenLabs TTS xətası" },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Speak route error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}