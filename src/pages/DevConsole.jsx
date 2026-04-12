// DevConsole — AI Development Assistant with GitHub integration
// Superadmin-only chat interface that can read/edit/push code via Claude + GitHub API

import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const SUPABASE_URL = "https://ngxdukdmudtebykmihgw.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/dev-console`;

const DevConsole = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [branch, setBranch] = useState("main");
  const [toolEvents, setToolEvents] = useState([]); // live tool activity for current response
  const [expandedTools, setExpandedTools] = useState({}); // toggle tool detail blocks
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolEvents]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: "user", content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setToolEvents([]);

    try {
      // Get JWT for auth
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;

      // Build messages for Claude (only role + content)
      const apiMessages = newMessages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGR1a2RtdWR0ZWJ5a21paGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTU3MjMsImV4cCI6MjA5MDI3MTcyM30.i4QTf0nC_zvO5YtpdXNGQPMcib_yWeMbCXz9PNsL15s",
        },
        body: JSON.stringify({ messages: apiMessages, branch }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Server error: ${err}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let currentToolEvents = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "text") {
              assistantText += event.content;
              // Update message in real-time
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last?._streaming) {
                  return [...prev.slice(0, -1), { ...last, content: assistantText }];
                }
                return [...prev, { role: "assistant", content: assistantText, timestamp: Date.now(), _streaming: true, tools: [] }];
              });
            } else if (event.type === "tool_start") {
              const te = { name: event.name, input: event.input, status: "running", result: null };
              currentToolEvents = [...currentToolEvents, te];
              setToolEvents([...currentToolEvents]);
            } else if (event.type === "tool_result") {
              currentToolEvents = currentToolEvents.map((t, i) =>
                i === currentToolEvents.length - 1 ? { ...t, status: "done", result: event.result } : t
              );
              setToolEvents([...currentToolEvents]);
            } else if (event.type === "error") {
              assistantText += `\n\n**Error:** ${event.content}`;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last?._streaming) {
                  return [...prev.slice(0, -1), { ...last, content: assistantText }];
                }
                return [...prev, { role: "assistant", content: assistantText, timestamp: Date.now(), _streaming: true, tools: [] }];
              });
            } else if (event.type === "done") {
              // Finalize
            }
          } catch (_) { /* skip malformed lines */ }
        }
      }

      // Finalize the assistant message with tool events attached
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last?._streaming) {
          return [...prev.slice(0, -1), { ...last, _streaming: false, tools: currentToolEvents }];
        }
        if (!assistantText) {
          return [...prev, { role: "assistant", content: "(No response)", timestamp: Date.now(), tools: currentToolEvents }];
        }
        return prev;
      });
      setToolEvents([]);

    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `**Error:** ${err.message}`, timestamp: Date.now(), tools: [] }]);
      setToolEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTool = (msgIdx, toolIdx) => {
    const key = `${msgIdx}-${toolIdx}`;
    setExpandedTools(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderContent = (text) => {
    if (!text) return null;
    // Simple markdown-ish rendering: code blocks, bold, inline code
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const content = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
        return (
          <pre key={i} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, padding: "10px 12px", fontSize: 12, overflowX: "auto", margin: "8px 0", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {content}
          </pre>
        );
      }
      // Handle bold, inline code, and newlines in regular text
      return (
        <span key={i} style={{ whiteSpace: "pre-wrap" }}>
          {part.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return <strong key={j} style={{ color: "#e6edf3" }}>{seg.slice(2, -2)}</strong>;
            }
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return <code key={j} style={{ background: "#161b22", padding: "1px 5px", borderRadius: 3, fontSize: 12, color: "#79c0ff" }}>{seg.slice(1, -1)}</code>;
            }
            return seg;
          })}
        </span>
      );
    });
  };

  const toolIcon = (name) => {
    const icons = { list_files: "\u{1F4C2}", read_file: "\u{1F4C4}", search_code: "\u{1F50D}", create_or_update_file: "\u270F\uFE0F", create_branch: "\u{1F33F}", list_branches: "\u{1F333}", git_push: "\u{1F680}" };
    return icons[name] || "\u2699\uFE0F";
  };

  const renderToolBlock = (tool, msgIdx, toolIdx, isLive) => {
    const key = `${msgIdx}-${toolIdx}`;
    const expanded = expandedTools[key];
    return (
      <div key={key} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
        <div
          onClick={() => !isLive && toggleTool(msgIdx, toolIdx)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: isLive ? "default" : "pointer", color: tool.status === "running" ? "#d29922" : "#3fb950" }}
        >
          <span>{toolIcon(tool.name)}</span>
          <span style={{ fontWeight: 600 }}>{tool.name}</span>
          {tool.input && <span style={{ color: "#484f58", fontSize: 10 }}>({Object.entries(tool.input).map(([k, v]) => `${k}: ${typeof v === "string" && v.length > 30 ? v.slice(0, 30) + "..." : v}`).join(", ")})</span>}
          {tool.status === "running" && <span style={{ marginLeft: "auto", animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>}
          {tool.status === "done" && <span style={{ marginLeft: "auto", color: "#3fb950" }}>&#10003;</span>}
          {!isLive && <span style={{ marginLeft: isLive ? 0 : 4, color: "#484f58", fontSize: 9 }}>{expanded ? "\u25B2" : "\u25BC"}</span>}
        </div>
        {expanded && tool.result && (
          <div style={{ padding: "6px 10px", borderTop: "1px solid #21262d", color: "#8b949e", fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
            {tool.result}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117", color: "#c9d1d9", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#58a6ff" }}>&gt;_ Dev Console</span>
          <span style={{ fontSize: 10, color: "#484f58", padding: "2px 8px", border: "1px solid #21262d", borderRadius: 99 }}>AI-Powered</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#484f58" }}>branch:</span>
          <input
            value={branch}
            onChange={e => setBranch(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, color: "#3fb950", padding: "3px 8px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", width: 120, outline: "none" }}
          />
          <span style={{ fontSize: 10, color: "#484f58" }}>{currentUser?.name}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 80, color: "#484f58" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#9000;</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#58a6ff", marginBottom: 6 }}>AI Dev Console</div>
            <div style={{ fontSize: 12, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
              Chat with an AI assistant that can read, edit, and push code to<br />
              <span style={{ color: "#3fb950" }}>elecbits-ODM-pms/elecbits-pms</span>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              {["Show me src/App.jsx", "List all files in src/pages/", "Search for 'TEAM_SLOTS'", "What does constants.jsx export?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", transition: "all .15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = "#58a6ff"; e.target.style.color = "#c9d1d9"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#30363d"; e.target.style.color = "#8b949e"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16, animation: "fadeUp .2s ease both" }}>
            {/* Role label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: msg.role === "user" ? "#58a6ff" : "#3fb950",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                {msg.role === "user" ? currentUser?.name || "You" : "Assistant"}
              </span>
              <span style={{ fontSize: 9, color: "#30363d" }}>
                {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Tool events for this message */}
            {msg.tools?.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {msg.tools.map((tool, ti) => renderToolBlock(tool, i, ti, false))}
              </div>
            )}

            {/* Message content */}
            <div style={{
              padding: msg.role === "user" ? "8px 12px" : "0",
              background: msg.role === "user" ? "#161b22" : "transparent",
              borderRadius: msg.role === "user" ? 8 : 0,
              border: msg.role === "user" ? "1px solid #21262d" : "none",
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              {renderContent(msg.content)}
            </div>
          </div>
        ))}

        {/* Live tool events while loading */}
        {isLoading && toolEvents.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {toolEvents.map((tool, ti) => renderToolBlock(tool, "live", ti, true))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && toolEvents.length === 0 && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#484f58", fontSize: 12, padding: "8px 0" }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>
            Thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid #21262d", padding: "12px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <span style={{ color: "#3fb950", fontSize: 14, fontWeight: 700, paddingBottom: 6 }}>&gt;</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask the AI to read, edit, or search code..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              color: "#c9d1d9",
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "'IBM Plex Mono', monospace",
              outline: "none",
              resize: "none",
              lineHeight: 1.5,
              minHeight: 40,
              maxHeight: 120,
            }}
            onInput={e => {
              e.target.style.height = "40px";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? "#21262d" : "#238636",
              border: "1px solid " + (isLoading || !input.trim() ? "#30363d" : "#2ea043"),
              borderRadius: 8,
              color: isLoading || !input.trim() ? "#484f58" : "#ffffff",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#30363d", marginTop: 6, textAlign: "center" }}>
          Shift+Enter for new line &middot; AI can read, edit, commit & push to GitHub &middot; Branch: {branch}
        </div>
      </div>
    </div>
  );
};

export default DevConsole;
