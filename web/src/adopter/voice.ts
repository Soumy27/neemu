// Neemu's voice. The backend sends a Polly MP3 (audioUrl). Until it does,
// the browser's own Hindi voice stands in, and the UI says so.

export function speak(text: string, audioUrl: string | null): { stop: () => void; via: "polly" | "browser" | "none" } {
  if (audioUrl) {
    const a = new Audio(audioUrl);
    a.play().catch(() => {});
    return { stop: () => a.pause(), via: "polly" };
  }
  if (!("speechSynthesis" in window)) return { stop: () => {}, via: "none" };
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "hi-IN";
  const hindi = speechSynthesis.getVoices().find((v) => v.lang.startsWith("hi"));
  if (hindi) u.voice = hindi;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return { stop: () => speechSynthesis.cancel(), via: "browser" };
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
};

// Voice in. Transcribe is the plan (backend); the browser recogniser is the stand-in.
export function listen(lang: "hi" | "en", onText: (t: string) => void, onDone: () => void): boolean {
  const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!R) return false;
  const r = new R();
  r.lang = lang === "hi" ? "hi-IN" : "en-IN";
  r.interimResults = false;
  r.onresult = (e) => onText(e.results[0][0].transcript);
  r.onerror = onDone;
  r.onend = onDone;
  r.start();
  return true;
}
