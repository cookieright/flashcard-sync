// Pronunciation inside the Android app.
// 1) Fetch Google Translate's voice directly with native HTTP (no website server needed).
// 2) If that fails (offline, blocked), use the phone's own text-to-speech engine.
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

let current: HTMLAudioElement | null = null;

async function googleVoice(text: string, lang: string) {
  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
    `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text.slice(0, 200))}`;
  const res = await CapacitorHttp.get({
    url,
    responseType: "blob",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
      Referer: "https://translate.google.com/",
    },
  });
  if (res.status !== 200 || typeof res.data !== "string" || !res.data) {
    throw new Error(`Google TTS ${res.status}`);
  }
  const audio = new Audio(`data:audio/mpeg;base64,${res.data}`);
  current = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio error"));
    audio.play().catch(reject);
  });
}

async function deviceVoice(text: string, lang: string) {
  await TextToSpeech.speak({ text, lang, rate: 0.9, category: "playback" });
}

export function installNativeSpeech() {
  if (!Capacitor.isNativePlatform()) return;
  window.__flashwordsNativeSpeak = async (text: string, lang: string) => {
    current?.pause();
    await TextToSpeech.stop().catch(() => {});
    try {
      await googleVoice(text, lang);
    } catch {
      await deviceVoice(text, lang);
    }
  };
}
