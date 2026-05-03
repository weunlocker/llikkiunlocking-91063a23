import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";

type Msg = { role: "user" | "assistant"; content: string };
type Channel = "wa" | "tg";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Inline Telegram paper-plane glyph (brand blue)
const TelegramIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M21.94 4.27a1.5 1.5 0 0 0-1.6-.2L3.4 11.1c-1.1.45-1.07 2.03.05 2.43l3.9 1.4 1.5 4.8a1 1 0 0 0 1.66.42l2.3-2.18 4.16 3.06c.86.63 2.1.16 2.32-.88l3.05-13.9a1.5 1.5 0 0 0-.4-1.98ZM9.7 14.6l8.4-6.4-6.95 7.45-.2 2.97-1.25-4.02Z" />
  </svg>
);

export default function AIChatWidget() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const { user, profile } = useAuth();
  if (pathname.startsWith("/admin")) return null;
  const brand = settings.brand_name || "LIKKI UNLOCKING";
  const logoUrl = settings.logo_url;
  const tgRaw = settings.telegram_url?.trim();
  const waRaw = settings.whatsapp_number?.trim();

  const initialGreeting: Msg = {
    role: "assistant",
    content: `👋 Hi! I'm the **${brand}** assistant. Ask me anything about IMEI checks, unlocks, pricing, or how it works.`,
  };

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Fresh chat on every page load — no persistence.
  const [messages, setMessages] = useState<Msg[]>([initialGreeting]);

  // Guest contact details (asked once when user is not logged in and tries to hand off)
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [pendingChannel, setPendingChannel] = useState<Channel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const showHandoff = userMsgCount >= 2;

  const buildTranscript = (contact?: { name?: string; email?: string; phone?: string }) => {
    const transcript = messages
      .slice(-10)
      .map((m) => `${m.role === "user" ? "Me" : brand + " AI"}: ${m.content}`)
      .join("\n");
    const name = contact?.name || profile?.display_name || "";
    const email = contact?.email || profile?.email || user?.email || "";
    const phone = contact?.phone || (profile as any)?.phone || "";
    const contactBlock = [
      name && `Name: ${name}`,
      email && `Email: ${email}`,
      phone && `Phone: ${phone}`,
    ].filter(Boolean).join("\n");
    return (
      `Hello ${brand} Team 👋\n\nI was chatting with your AI assistant and need a human.\n\n` +
      (contactBlock ? `— My details —\n${contactBlock}\n\n` : "") +
      `— Conversation —\n${transcript}`
    );
  };

  const openChannel = (channel: Channel, text: string) => {
    const enc = encodeURIComponent(text);
    let href: string | null = null;
    if (channel === "wa" && waRaw) href = `https://wa.me/${waRaw.replace(/[^\d]/g, "")}?text=${enc}`;
    if (channel === "tg" && tgRaw) {
      const tgUser = tgRaw.startsWith("http") ? tgRaw.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "") : tgRaw.replace(/^@/, "");
      href = `https://t.me/${tgUser}?text=${enc}`;
    }
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleHandoff = (channel: Channel) => {
    if (user) {
      openChannel(channel, buildTranscript());
    } else {
      setPendingChannel(channel);
    }
  };

  const submitGuestDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingChannel) return;
    if (!guestName.trim() || (!guestEmail.trim() && !guestPhone.trim())) return;
    openChannel(pendingChannel, buildTranscript({ name: guestName, email: guestEmail, phone: guestPhone }));
    setPendingChannel(null);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, pendingChannel]);

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
          className="fixed right-3 bottom-3 sm:right-4 sm:bottom-4 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={brand} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="text-sm font-extrabold tracking-tight">{brand.charAt(0)}</span>
          )}
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-2 left-2 sm:left-auto sm:right-4 bottom-3 sm:bottom-4 z-50 w-auto sm:w-[380px] max-h-[80vh] flex flex-col rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/20 to-purple-600/20 border-b border-border/60">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={brand} className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
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
            {showHandoff && (tgRaw || waRaw) && !pendingChannel && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                <div className="text-xs text-muted-foreground">
                  Need a human? Continue this chat with our team — your conversation{user ? " and account info" : " (and your details)"} will be sent automatically.
                </div>
                <div className="flex flex-wrap gap-2">
                  {waRaw && (
                    <button
                      type="button"
                      onClick={() => handleHandoff("wa")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#25D366] text-white hover:opacity-90 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  )}
                  {tgRaw && (
                    <button
                      type="button"
                      onClick={() => handleHandoff("tg")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#229ED9] text-white hover:opacity-90 transition"
                    >
                      <TelegramIcon className="w-3.5 h-3.5" /> Telegram
                    </button>
                  )}
                </div>
              </div>
            )}
            {pendingChannel && (
              <form onSubmit={submitGuestDetails} className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                <div className="text-xs font-semibold">
                  Share your contact so our team can reach you on {pendingChannel === "wa" ? "WhatsApp" : "Telegram"}:
                </div>
                <input
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name *"
                  maxLength={80}
                  className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-xs"
                />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email"
                  maxLength={120}
                  className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-xs"
                />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Phone (with country code)"
                  maxLength={30}
                  className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Provide email or phone (or both).</p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!guestName.trim() || (!guestEmail.trim() && !guestPhone.trim())}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-50 ${pendingChannel === "wa" ? "bg-[#25D366]" : "bg-[#229ED9]"}`}
                  >
                    Continue on {pendingChannel === "wa" ? "WhatsApp" : "Telegram"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingChannel(null)}
                    className="px-3 py-1.5 rounded-md text-xs bg-muted hover:bg-muted/70"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
