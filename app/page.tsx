"use client";

import { useState, useRef, useEffect } from "react";

import VoiceOrb from "@/components/VoiceOrb";
import HudBackground from "@/components/HudBackground";
import SystemPanel from "@/components/SystemPanel";
import ConversationPanel from "@/components/ConversationPanel";
import TopBar from "@/components/TopBar";
import { OrbState } from "@/lib/jarvis-theme";
import { useWakeWord } from "@/hooks/useWakeWord";

type Lang = "tr-TR" | "en-US" | "az-AZ";

export default function Home() {
  const [state, setState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [lang, setLang] = useState<Lang>("tr-TR");
  const [paused, setPaused] = useState(false);

  // Telefon ekranı aşkarlanır (wake word telefonda söndürülür)
  const [isMobile, setIsMobile] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // iOS Safari: toxunuş anında "açılmış" Audio elementi (sonra gecikmə ilə çalmaq üçün)
  const unlockedAudioRef = useRef<HTMLAudioElement | null>(null);
  const didSpeakRef = useRef(false); // ← YENİ: recording ərzində real səs aşkarlanıbmı?

  // Söhbət yaddaşı — Gemini-yə hər sorğuda göndərilir ki,
  // əvvəlki mesajları xatırlasın.
  type HistoryItem = { role: "user" | "model"; content: string };
  // QEYD: açar adı dəyişdi (əvvəl "ev_chat_history" idi). Köhnə istifadəçilərdə
  // localStorage-də köhnə açarla yaddaş qalıb, bu isə sıfırdan başlayacaq.
  // İstəsəniz köhnə açarı da oxuyub köçürmək üçün ayrıca miqrasiya əlavə edə bilərik.
  const HISTORY_KEY = "jarvis_chat_history";
  const historyRef = useRef<HistoryItem[]>([]);

  // =========================================================
  // NORMAL MACOS APP
  // =========================================================
  // Click-through is intentionally disabled.
  // This is a normal interactive Electron window, so all buttons
  // must receive mouse clicks normally.

  // =========================================================
  // MOBILE DETECTION
  // =========================================================

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, []);

  // =========================================================
  // ELEVENLABS TTS (yedek: browser TTS)
  // =========================================================

  const speakWithBrowserTTS = (text: string) => {
    try {
      window.speechSynthesis.cancel();

      setTimeout(() => {
        setState("speaking");

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = lang;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();

        if (lang === "en-US") {
          const samantha = voices.find(
            (voice) =>
              voice.name.toLowerCase().includes("samantha") &&
              voice.lang.toLowerCase().startsWith("en")
          );

          if (samantha) {
            utterance.voice = samantha;
          }
        }

        utterance.onend = () => {
          setState("idle");
        };

        utterance.onerror = (event) => {
          const errorType = (event as SpeechSynthesisErrorEvent).error;

          if (errorType === "interrupted" || errorType === "canceled") {
            console.warn("TTS interrupted:", errorType);
          } else {
            console.error("TTS error:", errorType);
          }

          setState("idle");
        };

        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (error) {
      console.error("Browser TTS error:", error);
      setState("idle");
    }
  };

  const speakResponse = async (text: string) => {
    // Evvelki sesi kes (ust-uste caxnasmasin)
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    window.speechSynthesis.cancel();

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("ElevenLabs TTS request failed");
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // iOS: toxunuşda "açılmış" elementi işlət, yoxdursa yenisini yarat
      const audio = unlockedAudioRef.current ?? new Audio();
      audio.src = audioUrl;

      ttsAudioRef.current = audio;

      audio.onplay = () => {
        setState("speaking");
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setState("idle");
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setState("idle");
      };

      await audio.play();
    } catch (error) {
      console.error("ElevenLabs TTS error, falling back to browser TTS:", error);
      speakWithBrowserTTS(text);
    }
  };

  // =========================================================
  // GEMINI
  // =========================================================

  const sendToGemini = async (text: string) => {
    setState("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          lang,
          history: historyRef.current,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gemini API error");
      }

      const responseText =
        data.response ||
        (lang === "en-US"
          ? "Sorry, I couldn't generate a response."
          : lang === "az-AZ"
          ? "Üzr istəyirəm, cavab yarada bilmədim."
          : "Üzgünüm, cavab yarada bilmədim.");

      if (Array.isArray(data.history)) {
        historyRef.current = data.history;

        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
        } catch (storageError) {
          console.error("History save error:", storageError);
        }
      }

      setTranscript(responseText);

      speakResponse(responseText);
    } catch (error) {
      console.error("API error:", error);

      setTranscript(
        lang === "en-US"
          ? "I encountered a connection problem."
          : lang === "az-AZ"
          ? "Bağlantı problemi yarandı."
          : "Bağlantı problemi yarandı, Elariz."
      );

      setState("idle");
    }
  };

  // =========================================================
  // ELEVENLABS SCRIBE STT
  // =========================================================

  const transcribeAudio = async (audioBlob: Blob) => {
    setState("thinking");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("lang", lang);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Transcribe API xətası");
      }

      const data = await res.json();
      const text = (data.text || "").trim();

      if (!text) {
        setTranscript(
          lang === "en-US"
            ? "I didn't hear anything."
            : lang === "az-AZ"
            ? "Heç nə eşidilmədi."
            : "Heç nə eşidilmədi, Elariz."
        );

        setState("idle");
        return;
      }

      setTranscript(text);

      await sendToGemini(text);
    } catch (error) {
      console.error("Transcribe error:", error);

      setTranscript(
        lang === "en-US"
          ? "I couldn't process your voice."
          : "Səsi mətnə çevirmək mümkün olmadı."
      );

      setState("idle");
    }
  };

  // =========================================================
  // STOP RECORDING
  // =========================================================

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // =========================================================
  // START LISTENING (yalnız real danışıq aşkarlanarsa STT-yə göndərir)
  // =========================================================

  const startListening = async () => {
    // iOS Safari: səsi toxunuş anında "aç" ki, sonra gecikmə ilə çala bilək
    if (!unlockedAudioRef.current) {
      const a = new Audio();
      a.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      a.play().catch(() => {});
      unlockedAudioRef.current = a;
    }

    // Pause aktivdirsə heç bir şəkildə dinləməyə başlama
    if (paused) {
      return;
    }

    if (state === "listening") {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopRecording();
      return;
    }

    if (state === "speaking") {
      window.speechSynthesis.cancel();

      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }

      setState("idle");
      return;
    }

    if (state !== "idle") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      didSpeakRef.current = false; // ← hər yeni recording-də sıfırla

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const spoke = didSpeakRef.current;
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        audioChunksRef.current = [];

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (!spoke) {
          // Heç danışılmayıb — sakitcə idle-a qayıt, API-yə heç nə göndərmə
          setState("idle");
          return;
        }

        transcribeAudio(audioBlob);
      };

      mediaRecorder.start();

      setState("listening");
      setTranscript("");

      // İlk N saniyə ərzində heç danışılmasa, ləğv et (STT/Gemini/TTS-ə getmir)
      const checkSilence = () => {
        if (mediaRecorder.state === "recording" && !didSpeakRef.current) {
          stopRecording();
        }
      };

      silenceTimerRef.current = setTimeout(checkSilence, 4000);

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);

      let lastSpeechTime = Date.now();
      let userStartedSpeaking = false;
      let sustainedFrames = 0;

      // Klaviatura/siçan kliki kimi qısa səs-küy pikləri (30-80ms) real
      // danışıq (davamlı) ilə qarışmasın deyə, "danışıq" statusunu yalnız
      // həcm ard-arda bir neçə frame boyu (≈150ms) yüksək qalanda veririk.
      const REQUIRED_SUSTAINED_FRAMES = 9; // rAF ~60fps zamanı ≈150ms

      const detectVoice = () => {
        if (
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state !== "recording"
        ) {
          audioContext.close();
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }

        const volume = Math.sqrt(sum / dataArray.length);
        const isLoudEnough = volume > 0.025;

        if (isLoudEnough) {
          sustainedFrames++;
        } else {
          sustainedFrames = 0;
        }

        const isSpeaking = sustainedFrames >= REQUIRED_SUSTAINED_FRAMES;

        if (isSpeaking) {
          userStartedSpeaking = true;
          didSpeakRef.current = true; // ← real (davamlı) səs aşkarlandı

          lastSpeechTime = Date.now();

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }

        if (userStartedSpeaking && Date.now() - lastSpeechTime >= 2000) {
          stopRecording();
          audioContext.close();
          return;
        }

        requestAnimationFrame(detectVoice);
      };

      detectVoice();
    } catch (error) {
      console.error("Microphone error:", error);

      setTranscript(
        lang === "en-US"
          ? "Microphone access was denied."
          : "Mikrofona giriş mümkün olmadı."
      );

      setState("idle");
    }
  };

  // =========================================================
  // PAUSE / RESUME HƏLİ (dayandırma + davam etdirmə əməliyyatları)
  // =========================================================

  const applyPause = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stopRecording();

    window.speechSynthesis.cancel();

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    setState("idle");

    console.log("J.A.R.V.I.S PAUSED");
  };

  const applyResume = () => {
    console.log("J.A.R.V.I.S RESUMED");
    // useWakeWord avtomatik olaraq !paused gördükdə yenidən aktiv olacaq.
  };

  // =========================================================
  // ELECTRON'DAN GƏLƏN PAUSE/RESUME STATE (tray menyusu)
  // =========================================================

  useEffect(() => {
    const electronBridge = (window as any).jarvis;

    if (!electronBridge?.onState) {
      return;
    }

    const unsubscribe = electronBridge.onState((data: { state: string }) => {
      if (data.state === "paused") {
        setPaused((prev) => {
          if (!prev) {
            applyPause();
          }
          return true;
        });
      } else if (data.state === "running") {
        setPaused((prev) => {
          if (prev) {
            applyResume();
          }
          return false;
        });
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // WAKE WORD — "Hey Jarvis" (telefonda söndürülüb, orbə toxunmaq kifayətdir)
  // =========================================================

  const { error: wakeWordError } = useWakeWord({
    enabled: state === "idle" && !paused && !isMobile,
    onWake: () => {
      (window as any).jarvis?.showWindow?.();
      startListening();
    },
  });

  useEffect(() => {
    if (wakeWordError) {
      console.error("Wake word error:", wakeWordError);
    }
  }, [wakeWordError]);

  // =========================================================
  // AUTO-CONTINUE — SÖNDÜRÜLÜB.
  // Əvvəllər cavab bitəndə mikrofon özü açılırdı. İndi isə cavab
  // bitəndə sadəcə "idle" halına qayıdır və növbəti dəfə YALNIZ
  // "Hey Jarvis" wake word-ü ilə yenidən dinləməyə başlayır.
  // =========================================================

  // =========================================================
  // ELECTRON GLOBAL TOGGLE (Cmd+Shift+E)
  // =========================================================

  useEffect(() => {
    const electronBridge = (window as any).jarvis;

    if (!electronBridge?.onToggleListening) {
      return;
    }

    const unsubscribe = electronBridge.onToggleListening(() => {
      startListening();
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lang, paused]);

  // =========================================================
  // LOAD CHAT HISTORY (yaddaş)
  // =========================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);

      if (saved) {
        historyRef.current = JSON.parse(saved);
      }
    } catch (error) {
      console.error("History load error:", error);
    }
  }, []);

  // =========================================================
  // LOAD MAC VOICES
  // =========================================================

  useEffect(() => {
    window.speechSynthesis.getVoices();

    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      handleVoicesChanged
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
    };
  }, []);

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }

      window.speechSynthesis.cancel();
    };
  }, []);

  // =========================================================
  // UI
  // =========================================================

  const langButtonClass = (active: boolean) => `
    px-2
    md:px-3
    py-1
    rounded
    font-mono
    text-xs
    border
    transition-all
    cursor-pointer
    ${
      active
        ? "border-cyan-400 text-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
        : "border-white/20 text-white/40 hover:text-white hover:border-white/40"
    }
  `;

  return (
    <main
      className="
        relative
        w-full
        h-dvh
        overflow-hidden
        select-none
        bg-black
        text-white
      "
    >
      {/* HUD BACKGROUND */}
      <HudBackground state={state} />

      {/* TOP BAR — tarix / J.A.R.V.I.S saat / CPU-MEM gauge */}
      <div>
        <TopBar state={state} />
      </div>

      {/* TOP SYSTEM PANEL */}
      <div className="absolute top-0 left-0 w-full z-20">
        <SystemPanel state={state} />
      </div>

      {/* LANGUAGE SELECTOR */}
      <div
        className="
          absolute
          top-[4.5rem]
          right-3
          md:top-6
          md:right-6
          z-50
          flex
          gap-2
        "
      >
        <button
          type="button"
          onClick={() => setLang("tr-TR")}
          className={langButtonClass(lang === "tr-TR")}
        >
          TR
        </button>

        <button
          type="button"
          onClick={() => setLang("en-US")}
          className={langButtonClass(lang === "en-US")}
        >
          EN
        </button>

        <button
          type="button"
          onClick={() => setLang("az-AZ")}
          className={langButtonClass(lang === "az-AZ")}
        >
          AZ
        </button>
      </div>
     

      {/* CENTER J.A.R.V.I.S */}
      <div
        className="
          absolute
          inset-0
          flex
          flex-col
          items-center
          justify-center
          pt-20
          pb-44
          md:pt-0
          md:pb-36
          z-10
        "
      >
        <div
          onClick={startListening}
          className="cursor-pointer origin-center scale-[0.7] sm:scale-90 lg:scale-100"
        >
          <VoiceOrb state={state} />
        </div>
      </div>

      {/* BOTTOM COMMAND / RESPONSE */}
      <div
        className="
          absolute
          bottom-4
          md:bottom-6
          left-1/2
          -translate-x-1/2
          w-full
          max-w-2xl
          px-3
          md:px-6
          z-30
        "
      >
        <div
          className="
            border
            border-cyan-500/20
            bg-black/40
            backdrop-blur-md
            rounded-xl
            px-4
            py-3
            md:px-5
            md:py-4
            shadow-[0_0_30px_rgba(6,182,212,0.08)]
          "
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />

            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/70">
              J.A.R.V.I.S RESPONSE
            </span>
          </div>

          <p className="font-mono text-xs md:text-sm text-white/80 min-h-[22px] max-h-[28dvh] overflow-y-auto">
            {transcript ? `> ${transcript}` : "> Awaiting command..."}
          </p>
        </div>
      </div>

      {/* BOTTOM STATUS */}
      <div
        className="
          hidden
          md:block
          absolute
          bottom-3
          left-6
          z-20
          font-mono
          text-[9px]
          tracking-[0.25em]
          text-white/20
        "
      >
        J.A.R.V.I.S // ONLINE
      </div>

      {/* LANGUAGE */}
      <div
        className="
          hidden
          md:block
          absolute
          bottom-3
          right-6
          z-20
          font-mono
          text-[9px]
          tracking-[0.25em]
          text-white/20
        "
      >
        {lang === "en-US" ? "EN-US" : lang === "az-AZ" ? "AZ-AZ" : "TR-TR"}
      </div>
    </main>
  );
}