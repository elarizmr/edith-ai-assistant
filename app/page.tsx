"use client";

import { useState, useRef, useEffect } from "react";

import VoiceOrb from "@/components/VoiceOrb";
import HudBackground from "@/components/HudBackground";
import SystemPanel from "@/components/SystemPanel";
import ConversationPanel from "@/components/ConversationPanel";
import TopBar from "@/components/TopBar";
import BottomDock from "@/components/BottomDock";
import { OrbState } from "@/lib/edith-theme";
import { useWakeWord } from "@/hooks/useWakeWord";

type Lang = "tr-TR" | "en-US" | "az-AZ";

export default function Home() {
  const [state, setState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [lang, setLang] = useState<Lang>("tr-TR");
  const [paused, setPaused] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoContinueRef = useRef(false);
  const didSpeakRef = useRef(false); // ← YENİ: recording ərzində real səs aşkarlanıbmı?

  // Söhbət yaddaşı — Gemini-yə hər sorğuda göndərilir ki,
  // əvvəlki mesajları xatırlasın.
  type HistoryItem = { role: "user" | "model"; content: string };
  const HISTORY_KEY = "edith_chat_history";
  const historyRef = useRef<HistoryItem[]>([]);

  // =========================================================
  // NORMAL MACOS APP
  // =========================================================
  // Click-through is intentionally disabled.
  // This is a normal interactive Electron window, so all buttons
  // must receive mouse clicks normally.

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
          autoContinueRef.current = true;
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
      const audio = new Audio(audioUrl);

      ttsAudioRef.current = audio;

      audio.onplay = () => {
        setState("speaking");
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        autoContinueRef.current = true;
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
        const isSpeaking = volume > 0.025;

        if (isSpeaking) {
          userStartedSpeaking = true;
          didSpeakRef.current = true; // ← real səs aşkarlandı

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
  // BOTTOM DOCK ACTIONS
  // =========================================================

  const handleToggleMute = () => {
    window.speechSynthesis.cancel();

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    if (state === "speaking") {
      setState("idle");
    }
  };

  const handleReset = () => {
    setTranscript("");
    historyRef.current = [];

    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error("History reset error:", error);
    }
  };

  // =========================================================
  // PAUSE / RESUME HƏLİ (dayandırma + davam etdirmə əməliyyatları)
  // =========================================================

  const applyPause = () => {
    autoContinueRef.current = false;

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

    console.log("E.D.I.T.H. PAUSED");
  };

  const applyResume = () => {
    console.log("E.D.I.T.H. RESUMED");
    // useWakeWord avtomatik olaraq !paused gördükdə yenidən aktiv olacaq.
  };

  // In-app (BottomDock) düyməsi
  const handleTogglePause = () => {
    setPaused((prev) => {
      const next = !prev;

      if (next) {
        applyPause();
      } else {
        applyResume();
      }

      // Electron main process-i də xəbərdar et (tray label, log və s. üçün)
      const edith = (window as any).edith;
      if (next) {
        edith?.pauseEDITH?.();
      } else {
        edith?.resumeEDITH?.();
      }

      return next;
    });
  };

  // =========================================================
  // ELECTRON'DAN GƏLƏN PAUSE/RESUME STATE (tray menyusu)
  // =========================================================

  useEffect(() => {
    const edith = (window as any).edith;

    if (!edith?.onEDITHState) {
      return;
    }

    const unsubscribe = edith.onEDITHState((data: { state: string }) => {
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
  // WAKE WORD — "Hey Edith"
  // =========================================================

  const { error: wakeWordError } = useWakeWord({
    enabled: state === "idle" && !paused,
    onWake: () => {
      (window as any).edith?.showWindow?.();
      startListening();
    },
  });

  useEffect(() => {
    if (wakeWordError) {
      console.error("Wake word error:", wakeWordError);
    }
  }, [wakeWordError]);

  // =========================================================
  // AUTO-CONTINUE — cavab bitəndə mikrofon özü açılsın
  // =========================================================

  useEffect(() => {
    if (state === "idle" && autoContinueRef.current && !paused) {
      autoContinueRef.current = false;
      const timer = setTimeout(() => {
        startListening();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [state, paused]);

  // =========================================================
  // ELECTRON GLOBAL TOGGLE (Cmd+Shift+E)
  // =========================================================

  useEffect(() => {
    const edith = (window as any).edith;

    if (!edith?.onToggleListening) {
      return;
    }

    const unsubscribe = edith.onToggleListening(() => {
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

  return (
    <main
      className="
        relative
        w-screen
        h-screen
        overflow-hidden
        select-none
        bg-black
        text-white
      "
    >
      {/* HUD BACKGROUND */}
      <HudBackground state={state} />

      {/* TOP BAR — tarix / EDITH saat / CPU-MEM gauge */}
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
          top-6
          right-6
          z-50
          flex
          gap-2
        "
      >
        <button
          type="button"
          onClick={() => setLang("tr-TR")}
          className={`
            px-3
            py-1
            rounded
            font-mono
            text-xs
            border
            transition-all
            cursor-pointer
            ${
              lang === "tr-TR"
                ? "border-cyan-400 text-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                : "border-white/20 text-white/40 hover:text-white hover:border-white/40"
            }
          `}
        >
          TR
        </button>

        <button
          type="button"
          onClick={() => setLang("en-US")}
          className={`
            px-3
            py-1
            rounded
            font-mono
            text-xs
            border
            transition-all
            cursor-pointer
            ${
              lang === "en-US"
                ? "border-cyan-400 text-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                : "border-white/20 text-white/40 hover:text-white hover:border-white/40"
            }
          `}
        >
          EN
        </button>

        <button
          type="button"
          onClick={() => setLang("az-AZ")}
          className={`
            px-3
            py-1
            rounded
            font-mono
            text-xs
            border
            transition-all
            cursor-pointer
            ${
              lang === "az-AZ"
                ? "border-cyan-400 text-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                : "border-white/20 text-white/40 hover:text-white hover:border-white/40"
            }
          `}
        >
          AZ
        </button>
      </div>

      {/* LEFT / CONVERSATION PANEL */}
      <div
        className="
          absolute
          left-6
          top-1/2
          -translate-y-1/2
          z-20
        "
      >
        <ConversationPanel transcript={transcript} state={state} />
      </div>

      {/* CENTER E.D.I.T.H */}
      <div
        className="
          absolute
          inset-0
          flex
          flex-col
          items-center
          justify-center
          pb-36
          z-10
        "
      >
        <div onClick={startListening} className="cursor-pointer">
          <VoiceOrb state={state} />
        </div>
      </div>

      {/* BOTTOM DOCK — mic / mute / reset / settings */}
      <div>
        <BottomDock
          state={state}
          bottomOffset={150}
          paused={paused}
          onToggleMic={startListening}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onReset={handleReset}
        />
      </div>

      {/* BOTTOM COMMAND / RESPONSE */}
      <div
        className="
          absolute
          bottom-6
          left-1/2
          -translate-x-1/2
          w-full
          max-w-2xl
          px-6
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
            px-5
            py-4
            shadow-[0_0_30px_rgba(6,182,212,0.08)]
          "
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />

            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/70">
              E.D.I.T.H. RESPONSE
            </span>
          </div>

          <p className="font-mono text-sm text-white/80 min-h-[22px]">
            {transcript ? `> ${transcript}` : "> Awaiting command..."}
          </p>
        </div>
      </div>

      {/* BOTTOM STATUS */}
      <div
        className="
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
        E.D.I.T.H. // ONLINE
      </div>

      {/* LANGUAGE */}
      <div
        className="
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