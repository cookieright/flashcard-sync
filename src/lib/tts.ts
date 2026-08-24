import { useCallback, useRef, useState } from "react";

/** Guess a language code for Google Translate TTS from the text itself. */
export function guessLang(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  return "en";
}

export function ttsUrl(text: string, lang = guessLang(text)) {
  return `/api/public/tts?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
}

/** Play pronunciation audio; falls back to the device speech engine. */
export function useSpeak() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string, lang?: string) => {
    const value = text.trim();
    if (!value) return;
    audioRef.current?.pause();

    const language = lang ?? guessLang(value);
    const audio = new Audio(ttsUrl(value, language));
    audioRef.current = audio;
    setSpeaking(true);
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(value);
        utter.lang = language;
        window.speechSynthesis.speak(utter);
      }
    };
    void audio.play().catch(() => audio.onerror?.(new Event("error")));
  }, []);

  return { speak, speaking };
}
