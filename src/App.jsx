import { useState, useRef, useEffect } from "react";
import { runAgent } from "./agent";

const SUGGESTIONS = [
  "Tip out: $6,200 sales, 4 servers, 3 bussers, 1 bartender",
  "We used 3 cases salmon, 2 chicken, ran out of lemon",
  "Tip out $3,800, 2 servers, 2 bussers",
  "Used 4 ribeye, 3 salmon, 2 halibut tonight. Big event Saturday",
];

function ToolBadge({ tool }) {
  const labels = {
    calculate_tip_out: { icon: "💵", label: "Tip Calculator" },
    analyze_inventory: { icon: "📦", label: "Inventory Advisor" },
  };
  const info = labels[tool.name] || { icon: "⚙️", label: tool.name };
  return (
    <div className="tool-badge">
      <span>{info.icon}</span>
      <span>{info.label} called</span>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg-row ${isUser ? "user" : "agent"}`}>
      {!isUser && <div className="avatar">M</div>}
      <div className="bubble-wrap">
        {msg.toolsUsed?.length > 0 && (
          <div className="tool-badges">
            {msg.toolsUsed.map((t, i) => <ToolBadge key={i} tool={t} />)}
          </div>
        )}
        <div className={`bubble ${isUser ? "bubble-user" : "bubble-agent"}`}>
          {msg.content.split("\n").map((line, i) => (
            <p key={i} style={{ margin: line === "" ? "6px 0" : "0" }}>{line}</p>
          ))}
        </div>
        <div className="ts">{msg.time}</div>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="msg-row agent">
      <div className="avatar">M</div>
      <div className="bubble bubble-agent thinking">
        <span /><span /><span />
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg = { role: "user", content: userText, time: now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    const history = next.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    try {
      const origFetch = window.fetch;
      window.fetch = (url, opts) => {
        if (url.includes("anthropic.com")) {
          opts.headers = {
            ...opts.headers,
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          };
        }
        return origFetch(url, opts);
      };

      const { text: reply, toolsUsed } = await runAgent(history);
      window.fetch = origFetch;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, toolsUsed, time: now() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, toolsUsed: [], time: now() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!keySet) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-logo">MISE</div>
          <p className="gate-sub">AI Operations Agent for Restaurant Managers</p>
          <p className="gate-desc">
            Enter your Anthropic API key to start. Stays in your browser only.
          </p>
          <input
            className="gate-input"
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apiKey.startsWith("sk-") && setKeySet(true)}
            autoFocus
          />
          <button
            className="gate-btn"
            disabled={!apiKey.startsWith("sk-")}
            onClick={() => setKeySet(true)}
          >
            Launch Mise →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">MISE</div>
          <div className="header-meta">
            <span className="status-dot" />
            <span className="status-text">Operations Agent · Online</span>
          </div>
        </div>
        <div className="header-caps">TIP OUTS · INVENTORY · END OF SHIFT</div>
      </header>

      <main className="chat">
        {messages.length === 0 && (
          <div className="empty">
            <div className="empty-title">Good evening, Chef.</div>
            <div className="empty-sub">
              Tell me about tonight — tip outs, inventory, what you ran out of.
              I'll handle the numbers.
            </div>
            <div className="chips">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && <Thinking />}
        <div ref={bottomRef} />
      </main>

      <footer className="footer">
        <textarea
          ref={inputRef}
          className="input"
          rows={1}
          placeholder="Tell me about tonight's shift…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="send-btn"
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
