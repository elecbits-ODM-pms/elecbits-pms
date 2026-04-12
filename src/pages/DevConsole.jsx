// DevConsole — AI Development Assistant (Azoox) with GitHub integration
// Superadmin-only chat interface that talks to the Azoox server running on Fly.io
// The server uses Claude Agent SDK with OAuth subscription auth

import { useState, useRef, useEffect } from "react";

// Azoox backend URL — Fly.io deployment
const AZOOX_URL = import.meta.env.VITE_AZOOX_URL || "https://azoox-server.fly.dev";
const AZOOX_SECRET = import.meta.env.VITE_AZOOX_SECRET || "";

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
      // Build messages for the agent
      const apiMessages = newMessages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      const res = await fetch(`${AZOOX_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-azoox-secret": AZOOX_SECRET,
        },
        body: JSON.stringify({ messages: apiMessages, branch }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Server error: ${err}`);
      }

      // Read NDJSON stream from Claude Agent SDK
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let currentToolEvents = [];
      let buffer = "";

      const pushAssistantUpdate = () => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last?._streaming) {
            return [...prev.slice(0, -1), { ...last, content: assistantText }];
          }
          return [...prev, { role: "assistant", content: assistantText, timestamp: Date.now(), _streaming: true, tools: [] }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            // Claude Agent SDK message types
            if (msg.type === "assistant" && msg.message?.content) {
              // Full assistant message — extract text blocks
              const textBlocks = msg.message.content.filter(b => b.type === "text");
              const toolUseBlocks = msg.message.content.filter(b => b.type === "tool_use");

              for (const block of textBlocks) {
                if (block.text) {
                  assistantText += (assistantText ? "\n" : "") + block.text;
                }
              }
              if (textBlocks.length) pushAssistantUpdate();

              for (const tu of toolUseBlocks) {
                currentToolEvents = [...currentToolEvents, {
                  name: tu.name,
                  input: tu.input,
                  status: "running",
                  result: null,
                }];
                setToolEvents([...currentToolEvents]);
              }
            } else if (msg.type === "user" && msg.message?.content) {
              // Tool results come back as user messages with tool_result blocks
              const toolResults = msg.message.content.filter(b => b.type === "tool_result");
              for (const tr of toolResults) {
                const resultText = typeof tr.content === "string"
                  ? tr.content
                  : Array.isArray(tr.content)
                    ? tr.content.map(c => c.text || "").join("")
                    : JSON.stringify(tr.content);
                currentToolEvents = currentToolEvents.map((t, i) =>
                  i === currentToolEvents.length - 1 && t.status === "running"
                    ? { ...t, status: "done", result: resultText.slice(0, 500) }
                    : t
                );
                setToolEvents([...currentToolEvents]);
              }
            } else if (msg.type === "result") {
              // Final result with full text
              if (msg.result && typeof msg.result === "string") {
                assistantText = msg.result;
                pushAssistantUpdate();
              }
            } else if (msg.type === "error") {
              assistantText += `\n\n**Error:** ${msg.error}`;
              pushAssistantUpdate();
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
          <pre key={i} style={{ background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, padding: "10px 12px", fontSize: 12, overflowX: "auto", margin: "8px 0", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#1f2328" }}>
            {content}
          </pre>
        );
      }
      // Handle bold, inline code, and newlines in regular text
      return (
        <span key={i} style={{ whiteSpace: "pre-wrap" }}>
          {part.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return <strong key={j} style={{ color: "#1f2328" }}>{seg.slice(2, -2)}</strong>;
            }
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return <code key={j} style={{ background: "#eff1f3", padding: "1px 5px", borderRadius: 3, fontSize: 12, color: "#0550ae" }}>{seg.slice(1, -1)}</code>;
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
      <div key={key} style={{ background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
        <div
          onClick={() => !isLive && toggleTool(msgIdx, toolIdx)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: isLive ? "default" : "pointer", color: tool.status === "running" ? "#9a6700" : "#1a7f37" }}
        >
          <span>{toolIcon(tool.name)}</span>
          <span style={{ fontWeight: 600 }}>{tool.name}</span>
          {tool.input && <span style={{ color: "#656d76", fontSize: 10 }}>({Object.entries(tool.input).map(([k, v]) => `${k}: ${typeof v === "string" && v.length > 30 ? v.slice(0, 30) + "..." : v}`).join(", ")})</span>}
          {tool.status === "running" && <span style={{ marginLeft: "auto", animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>}
          {tool.status === "done" && <span style={{ marginLeft: "auto", color: "#1a7f37" }}>&#10003;</span>}
          {!isLive && <span style={{ marginLeft: isLive ? 0 : 4, color: "#656d76", fontSize: 9 }}>{expanded ? "\u25B2" : "\u25BC"}</span>}
        </div>
        {expanded && tool.result && (
          <div style={{ padding: "6px 10px", borderTop: "1px solid #d0d7de", color: "#656d76", fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
            {tool.result}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", color: "#1f2328", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #d0d7de", flexShrink: 0, background: "#f6f8fa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0550ae" }}>&gt;_ Dev Console</span>
          <span style={{ fontSize: 10, color: "#656d76", padding: "2px 8px", border: "1px solid #d0d7de", borderRadius: 99, background: "#ffffff" }}>AI-Powered</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#656d76" }}>branch:</span>
          <input
            value={branch}
            onChange={e => setBranch(e.target.value)}
            style={{ background: "#ffffff", border: "1px solid #d0d7de", borderRadius: 4, color: "#1a7f37", padding: "3px 8px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", width: 120, outline: "none" }}
          />
          <span style={{ fontSize: 10, color: "#656d76" }}>{currentUser?.name}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 80, color: "#656d76" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#9000;</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0550ae", marginBottom: 6 }}>AI Dev Console</div>
            <div style={{ fontSize: 12, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
              Chat with an AI assistant that can read, edit, and push code to<br />
              <span style={{ color: "#1a7f37" }}>elecbits-ODM-pms/elecbits-pms</span>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              {["Show me src/App.jsx", "List all files in src/pages/", "Search for 'TEAM_SLOTS'", "What does constants.jsx export?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{ background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, color: "#656d76", padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", transition: "all .15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = "#0550ae"; e.target.style.color = "#1f2328"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#d0d7de"; e.target.style.color = "#656d76"; }}
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
                color: msg.role === "user" ? "#0550ae" : "#1a7f37",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                {msg.role === "user" ? currentUser?.name || "You" : "Azoox"}
              </span>
              <span style={{ fontSize: 9, color: "#afb8c1" }}>
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
              background: msg.role === "user" ? "#f6f8fa" : "transparent",
              borderRadius: msg.role === "user" ? 8 : 0,
              border: msg.role === "user" ? "1px solid #d0d7de" : "none",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#656d76", fontSize: 12, padding: "8px 0" }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>
            Thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid #d0d7de", padding: "12px 20px", flexShrink: 0, background: "#f6f8fa" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <span style={{ color: "#1a7f37", fontSize: 14, fontWeight: 700, paddingBottom: 6 }}>&gt;</span>
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
              background: "#ffffff",
              border: "1px solid #d0d7de",
              borderRadius: 8,
              color: "#1f2328",
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
              background: isLoading || !input.trim() ? "#e1e4e8" : "#2563eb",
              border: "1px solid " + (isLoading || !input.trim() ? "#d0d7de" : "#1d4ed8"),
              borderRadius: 8,
              color: isLoading || !input.trim() ? "#8b949e" : "#ffffff",
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
        <div style={{ fontSize: 9, color: "#afb8c1", marginTop: 6, textAlign: "center" }}>
          Shift+Enter for new line &middot; AI can read, edit, commit & push to GitHub &middot; Branch: {branch}
        </div>
      </div>
    </div>
  );
};

export default DevConsole;
