"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Hey Jarvis" wake-word dinləyicisi — Vosk (offline,
 * pulsuz, hesab lazım deyil) ilə işləyir. Model brauzerdə WASM olaraq
 * yüklənir, mikrofon davamlı açıq qalır, amma yalnız `enabled` true
 * olanda tanınan mətn wake-phrase yoxlamasından keçir.
 *
 * QEYD: Client Component-dən çağırılmalıdır ("use client").
 */

interface UseWakeWordOptions {
  enabled: boolean;
  onWake: () => void;
  modelPath?: string;

  wakePhrases?: string[];
  /** Ard-arda tetiklənmənin qarşısını almaq üçün minimum aralıq (ms) */
  cooldownMs?: number;
}

export function useWakeWord({
  enabled,
  onWake,
  modelPath = "/models/vosk-model-small-en-us-0.15.tar.gz",
  wakePhrases = [
    "hey jarvis",
    "jarvis wake up",
    "jarvis, wake up",
    "wake up jarvis",
    "jarvis",
    // Vosk kiçik ingilis fonem modeli "jarvis" sözünü bəzən
    // bunlara yaxın tanıya bilər — tolerantlıq üçün əlavə edilib
    "jarves",
    "garvis",
    "charvis",
    "jarvus",
    "harvis",
  ],
  cooldownMs = 3000,
}: UseWakeWordOptions) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledRef = useRef(enabled);
  const onWakeRef = useRef(onWake);
  const lastTriggerRef = useRef(0);
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  enabledRef.current = enabled;
  onWakeRef.current = onWake;

  const checkWake = (text: string) => {
    const normalized = text.toLowerCase().trim();

    if (!normalized) return;

    const now = Date.now();

    if (now - lastTriggerRef.current < cooldownMs) return;

    const matched = wakePhrases.some((phrase) =>
      normalized.includes(phrase)
    );

    if (matched && enabledRef.current) {
      lastTriggerRef.current = now;
      onWakeRef.current();
    }
  };

  // Model + recognizer + mikrofon axını BIR DEFE qurulur ve tetbiq
  // omru boyu davam edir (davamli dinleme). `enabled` ise yalniz
  // gelen setleri wake-phrase yoxlamasindan kecirib-kecirmemeyi idare edir.
  useEffect(() => {
    let cancelled = false;

    const handleVisibilityChange = () => {
      const audioContext = audioContextRef.current;
      if (
        document.visibilityState === "visible" &&
        audioContext &&
        audioContext.state === "suspended"
      ) {
        audioContext.resume();
      }
    };

    (async () => {
      try {
        const Vosk = await import("vosk-browser");

        const model = await Vosk.createModel(modelPath);

        if (cancelled) return;

        // AudioContext-i recognizer-den evvel yaradiriq ki, onun real
        // sample rate-ini KaldiRecognizer-e ote bilek (kitabxananin
        // TypeScript tipi buna gore sampleRate parametri teleb edir:
        // `new (sampleRate: number, grammar?: string)`).
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        console.log("AudioContext state:", audioContext.state); // müvəqqəti debug
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const recognizer = new model.KaldiRecognizer(audioContext.sampleRate);

        recognizer.on("result", (message: any) => {
          console.log("VOSK RESULT:", message?.result?.text); // müvəqqəti debug
          checkWake(message?.result?.text || "");
        });

        recognizer.on("partialresult", (message: any) => {
          console.log("VOSK PARTIAL:", message?.result?.partial); // müvəqqəti debug
          checkWake(message?.result?.partial || "");
        });

        recognizerRef.current = recognizer;

        // ScriptProcessorNode deprecated olsa da, vosk-browser-in
        // resmi nümunesi bunu istifade edir ve butun brauzerlerde
        // (Electron/Chromium daxil) stabil isleyir.
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          try {
            recognizer.acceptWaveform(event.inputBuffer);
          } catch (err) {
            console.error("Vosk acceptWaveform xətası:", err);
          }
        };

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(processor);
        // ScriptProcessorNode-un işləməsi üçün destination-a da
        // bağlamaq lazımdır (səs çıxışa getmir, sadəcə node aktiv olur).
        processor.connect(audioContext.destination);

        setReady(true);
      } catch (err) {
        console.error("Vosk init xətası:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      processorRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognizerRef.current?.remove?.();

      processorRef.current = null;
      audioContextRef.current = null;
      streamRef.current = null;
      recognizerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath]);

  return { ready, error };
}