import { createFileRoute } from "@tanstack/react-router";

/** Proxy to Google Translate's text-to-speech so the browser can play it (avoids CORS). */
export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const text = (url.searchParams.get("q") ?? "").slice(0, 200).trim();
        const lang = (url.searchParams.get("lang") ?? "en").slice(0, 10);

        if (!text) return new Response("Missing q", { status: 400 });
        if (!/^[a-zA-Z-]{2,10}$/.test(lang)) return new Response("Bad lang", { status: 400 });

        const target = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
          lang,
        )}&q=${encodeURIComponent(text)}`;

        const upstream = await fetch(target, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Referer: "https://translate.google.com/",
          },
        });

        if (!upstream.ok || !upstream.body) {
          return new Response("TTS unavailable", { status: 502 });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
