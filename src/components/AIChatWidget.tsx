import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORAGE_KEY = "likki_ai_chat_v1";

export default function AIChatWidget() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  if (pathname.startsWith("/admin")) return null;
  const brand = settings.brand_name || "LIKKI UNLOCKING";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [
      {
        role: "assistant",
        content: `👋 Hi! I'm the **${brand}** assistant. Ask me anything about IMEI checks, unlocks, pricing, or how it works.`,
      },
    ];
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content !== messages[messages.length - 1]?.content) {
          // we already appended an assistant message — replace its content
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        let errMsg = "Sorry, I'm having trouble responding right now.";
        if (resp.status === 429) errMsg = "Too many messages — please wait a moment.";
        else if (resp.status === 402) errMsg = "AI service unavailable. Please contact us on WhatsApp/Telegram.";
        try { const j = await resp.json(); if (j?.error) errMsg = j.error; } catch { /* ignore */ }
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(j);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      {/* Trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with AI assistant"
          className="fixed right-3 bottom-32 sm:right-4 sm:bottom-36 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-2 left-2 sm:left-auto sm:right-4 bottom-3 sm:bottom-4 z-50 w-auto sm:w-[380px] max-h-[80vh] flex flex-col rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/20 to-purple-600/20 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">{brand} Assistant</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online · Replies instantly
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[260px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 p-2 border-t border-border/60 bg-background/80"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about unlocks, pricing, IMEI…"
              className="flex-1 bg-muted/40 border border-border/60 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-center text-muted-foreground pb-2">
            Powered by AI · For private order help, use WhatsApp / Telegram.
          </div>
        </div>
      )}
    </>
  );
}
