// DevConsole — AI Development Assistant (Azoox) with GitHub integration
// Superadmin-only chat interface that talks to the Azoox server running on Fly.io
// The server uses Claude Agent SDK with OAuth subscription auth

import { useState, useRef, useEffect } from "react";

// Azoox backend URL — Fly.io deployment
const AZOOX_URL = import.meta.env.VITE_AZOOX_URL || "https://azoox-server.fly.dev";
const AZOOX_SECRET = import.meta.env.VITE_AZOOX_SECRET || "";

const STORAGE_KEY = "azoox:state:v1";
const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const DevConsole = ({ currentUser }) => {
  const persisted = loadPersisted();
  const [messages, setMessages] = useState(persisted.messages || []);
  const [input, setInput] = useState(persisted.input || "");
  const [isLoading, setIsLoading] = useState(false);
  const [branch, setBranch] = useState(persisted.branch || "main");
  const [toolEvents, setToolEvents] = useState([]); // live tool activity for current response
  const [expandedTools, setExpandedTools] = useState({}); // toggle tool detail blocks
  const [sessionInfo, setSessionInfo] = useState(null); // init info from current stream
  const [liveText, setLiveText] = useState(""); // partial assistant text as it streams
  const [liveThinking, setLiveThinking] = useState(""); // partial extended thinking text
  const [statusLine, setStatusLine] = useState(""); // short status like "Reading file.js"
  const [restoredCount] = useState((persisted.messages || []).length); // chats loaded from storage
  const [historyVisible, setHistoryVisible] = useState(restoredCount > 0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const serializable = messages.map(({ _streaming, ...m }) => m);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: serializable, input, branch }));
    } catch { /* quota or serialization errors — ignore */ }
  }, [messages, input, branch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolEvents, liveText, liveThinking, statusLine]);

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
    setLiveText("");
    setLiveThinking("");
    setSessionInfo(null);
    setStatusLine("Connecting to Azoox...");

    try {
      // Build messages for the agent — includes ALL persisted history so the
      // server has full context of previous chats
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
      let thinkingText = "";
      let currentToolEvents = [];
      let buffer = "";
      // Track partial content blocks coming in via stream_event
      // Map of contentBlockIndex → { type: 'text'|'tool_use'|'thinking', textSoFar, partialJson, toolName, toolId, toolEventIdx }
      const liveBlocks = {};

      const commitLiveText = () => setLiveText(assistantText);
      const commitLiveThinking = () => setLiveThinking(thinkingText);

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
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }

          // ─── System init / subtypes (session info, retries, etc.) ────
          if (msg.type === "system") {
            if (msg.subtype === "init") {
              setSessionInfo({
                session_id: msg.session_id,
                model: msg.model,
                cwd: msg.cwd,
                tools: msg.tools,
                permission_mode: msg.permissionMode,
              });
              setStatusLine(`Session ready · ${msg.model || "claude"}`);
            } else if (msg.subtype === "api_retry") {
              setStatusLine(`Retrying API (attempt ${msg.attempt}/${msg.max_retries})...`);
            } else if (msg.subtype === "compact_boundary") {
              setStatusLine("Compacting conversation...");
            }
            continue;
          }

          // ─── Raw streaming events (partial text / partial tool input) ────
          if (msg.type === "stream_event" && msg.event) {
            const ev = msg.event;
            if (ev.type === "content_block_start" && ev.content_block) {
              const idx = ev.index;
              const cb = ev.content_block;
              if (cb.type === "text") {
                liveBlocks[idx] = { type: "text", textSoFar: "" };
              } else if (cb.type === "thinking") {
                liveBlocks[idx] = { type: "thinking", textSoFar: "" };
                setStatusLine("Thinking...");
              } else if (cb.type === "tool_use") {
                const toolEventIdx = currentToolEvents.length;
                currentToolEvents = [...currentToolEvents, {
                  name: cb.name,
                  id: cb.id,
                  input: {},
                  _partialJson: "",
                  status: "running",
                  result: null,
                  startedAt: Date.now(),
                }];
                setToolEvents([...currentToolEvents]);
                liveBlocks[idx] = { type: "tool_use", toolName: cb.name, toolId: cb.id, partialJson: "", toolEventIdx };
                setStatusLine(`Running ${cb.name}...`);
              }
            } else if (ev.type === "content_block_delta" && ev.delta) {
              const idx = ev.index;
              const block = liveBlocks[idx];
              if (!block) continue;
              if (ev.delta.type === "text_delta" && block.type === "text") {
                block.textSoFar += ev.delta.text || "";
                assistantText = Object.values(liveBlocks)
                  .filter(b => b.type === "text")
                  .map(b => b.textSoFar)
                  .join("\n");
                commitLiveText();
              } else if (ev.delta.type === "thinking_delta" && block.type === "thinking") {
                block.textSoFar += ev.delta.thinking || "";
                thinkingText = block.textSoFar;
                commitLiveThinking();
              } else if (ev.delta.type === "input_json_delta" && block.type === "tool_use") {
                block.partialJson += ev.delta.partial_json || "";
                // Attempt to parse the accumulated partial JSON for live display
                let parsed = null;
                try { parsed = JSON.parse(block.partialJson); } catch { /* not yet complete */ }
                currentToolEvents = currentToolEvents.map((t, i) =>
                  i === block.toolEventIdx
                    ? { ...t, _partialJson: block.partialJson, input: parsed || t.input }
                    : t
                );
                setToolEvents([...currentToolEvents]);
              }
            } else if (ev.type === "content_block_stop") {
              // nothing needed — full block will arrive via 'assistant' message
            } else if (ev.type === "message_stop") {
              setStatusLine("Finalizing response...");
            }
            continue;
          }

          // ─── Full assistant message (end of a block) ────
          if (msg.type === "assistant" && msg.message?.content) {
            const textBlocks = msg.message.content.filter(b => b.type === "text");
            const toolUseBlocks = msg.message.content.filter(b => b.type === "tool_use");

            if (textBlocks.length) {
              // Reconcile streamed text with authoritative content
              assistantText = textBlocks.map(b => b.text || "").join("\n");
              commitLiveText();
              pushAssistantUpdate();
            }

            for (const tu of toolUseBlocks) {
              // Reconcile: if we already tracked this tool_use via stream_event, update its input
              const existingIdx = currentToolEvents.findIndex(t => t.id === tu.id);
              if (existingIdx >= 0) {
                currentToolEvents = currentToolEvents.map((t, i) =>
                  i === existingIdx ? { ...t, input: tu.input, _partialJson: undefined } : t
                );
              } else {
                currentToolEvents = [...currentToolEvents, {
                  name: tu.name,
                  id: tu.id,
                  input: tu.input,
                  status: "running",
                  result: null,
                  startedAt: Date.now(),
                }];
              }
              setToolEvents([...currentToolEvents]);
              setStatusLine(`Running ${tu.name}...`);
            }
            continue;
          }

          // ─── Tool results (arrive as user/tool_result messages) ────
          if (msg.type === "user" && msg.message?.content) {
            const toolResults = msg.message.content.filter(b => b.type === "tool_result");
            for (const tr of toolResults) {
              const resultText = typeof tr.content === "string"
                ? tr.content
                : Array.isArray(tr.content)
                  ? tr.content.map(c => c.text || "").join("")
                  : JSON.stringify(tr.content);
              // Match result to its tool_use by id if available, else latest running
              const matchIdx = tr.tool_use_id
                ? currentToolEvents.findIndex(t => t.id === tr.tool_use_id)
                : currentToolEvents.findLastIndex
                  ? currentToolEvents.findLastIndex(t => t.status === "running")
                  : currentToolEvents.map(t => t.status).lastIndexOf("running");
              if (matchIdx >= 0) {
                currentToolEvents = currentToolEvents.map((t, i) =>
                  i === matchIdx
                    ? { ...t, status: tr.is_error ? "error" : "done", result: resultText, finishedAt: Date.now() }
                    : t
                );
                setToolEvents([...currentToolEvents]);
              }
              setStatusLine("Working...");
            }
            continue;
          }

          // ─── Final result ────
          if (msg.type === "result") {
            if (msg.subtype === "success" && msg.result && typeof msg.result === "string") {
              assistantText = msg.result;
              commitLiveText();
              pushAssistantUpdate();
            } else if (msg.subtype && msg.subtype.startsWith("error")) {
              assistantText += `\n\n**Error:** ${msg.result || msg.subtype}`;
              pushAssistantUpdate();
            }
            setStatusLine("");
            continue;
          }

          if (msg.type === "error") {
            assistantText += `\n\n**Error:** ${msg.error}`;
            pushAssistantUpdate();
            setStatusLine("");
          }
        }
      }

      // Finalize the assistant message with tool events attached
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last?._streaming) {
          return [...prev.slice(0, -1), { ...last, _streaming: false, tools: currentToolEvents, thinking: thinkingText || undefined }];
        }
        if (!assistantText) {
          return [...prev, { role: "assistant", content: "(No response)", timestamp: Date.now(), tools: currentToolEvents, thinking: thinkingText || undefined }];
        }
        return prev;
      });
      setToolEvents([]);
      setLiveText("");
      setLiveThinking("");
      setStatusLine("");

    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `**Error:** ${err.message}`, timestamp: Date.now(), tools: [] }]);
      setToolEvents([]);
      setLiveText("");
      setLiveThinking("");
      setStatusLine("");
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all chat history? This cannot be undone.")) return;
    setMessages([]);
    setInput("");
    setSessionInfo(null);
    setHistoryVisible(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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
    const icons = {
      Read: "\u{1F4C4}", Write: "\u270F\uFE0F", Edit: "\u270F\uFE0F",
      Bash: "\u{1F4BB}", Glob: "\u{1F4C2}", Grep: "\u{1F50D}",
      list_files: "\u{1F4C2}", read_file: "\u{1F4C4}", search_code: "\u{1F50D}",
      create_or_update_file: "\u270F\uFE0F", create_branch: "\u{1F33F}",
      list_branches: "\u{1F333}", git_push: "\u{1F680}",
    };
    return icons[name] || "\u2699\uFE0F";
  };

  // Short one-line summary for a tool call header — e.g. "Read src/App.jsx"
  const toolSummary = (tool) => {
    const inp = tool.input || {};
    if (inp.file_path) return String(inp.file_path);
    if (inp.command) return String(inp.command).slice(0, 80);
    if (inp.pattern) return `"${String(inp.pattern).slice(0, 60)}"`;
    if (inp.path && inp.pattern === undefined) return String(inp.path);
    if (inp.old_string) return `edit (${String(inp.old_string).slice(0, 40)}...)`;
    const keys = Object.keys(inp);
    if (!keys.length) return "";
    return keys.slice(0, 2).map(k => `${k}: ${JSON.stringify(inp[k]).slice(0, 40)}`).join(", ");
  };

  // Pretty-print the full tool input (expanded view)
  const formatToolInput = (inp) => {
    if (!inp) return "(no input)";
    try { return JSON.stringify(inp, null, 2); } catch { return String(inp); }
  };

  const renderToolBlock = (tool, msgIdx, toolIdx, isLive) => {
    const key = `${msgIdx}-${toolIdx}`;
    // Auto-expand the currently-running live tool so the user sees it working
    const autoExpand = isLive && tool.status === "running";
    const expanded = autoExpand || expandedTools[key];
    const statusColor = tool.status === "running" ? "#9a6700" : tool.status === "error" ? "#cf222e" : "#1a7f37";
    const resultText = tool.result || (tool._partialJson ? `(streaming input...)\n${tool._partialJson}` : "");
    const duration = tool.startedAt && tool.finishedAt ? `${((tool.finishedAt - tool.startedAt) / 1000).toFixed(1)}s` : null;
    return (
      <div key={key} style={{ background: "#f6f8fa", border: `1px solid ${tool.status === "error" ? "#ffb3b3" : "#d0d7de"}`, borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
        <div
          onClick={() => toggleTool(msgIdx, toolIdx)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", cursor: "pointer", color: statusColor }}
        >
          <span>{toolIcon(tool.name)}</span>
          <span style={{ fontWeight: 700 }}>{tool.name}</span>
          <span style={{ color: "#656d76", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {toolSummary(tool)}
          </span>
          {duration && <span style={{ color: "#8b949e", fontSize: 9 }}>{duration}</span>}
          {tool.status === "running" && <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>}
          {tool.status === "done" && <span style={{ color: "#1a7f37" }}>&#10003;</span>}
          {tool.status === "error" && <span style={{ color: "#cf222e" }}>&#10007;</span>}
          <span style={{ color: "#656d76", fontSize: 9 }}>{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
        {expanded && (
          <div style={{ borderTop: "1px solid #d0d7de", fontSize: 11 }}>
            {/* Full tool input */}
            {tool.input && Object.keys(tool.input).length > 0 && (
              <div style={{ padding: "6px 10px", borderBottom: resultText ? "1px solid #e1e4e8" : "none" }}>
                <div style={{ color: "#0550ae", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Input</div>
                <pre style={{ margin: 0, color: "#1f2328", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'IBM Plex Mono', monospace", maxHeight: 160, overflowY: "auto" }}>
                  {formatToolInput(tool.input)}
                </pre>
              </div>
            )}
            {/* Full tool result */}
            {resultText && (
              <div style={{ padding: "6px 10px" }}>
                <div style={{ color: tool.status === "error" ? "#cf222e" : "#1a7f37", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>
                  {tool.status === "error" ? "Error" : "Result"}
                </div>
                <pre style={{ margin: 0, color: "#1f2328", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'IBM Plex Mono', monospace", maxHeight: 260, overflowY: "auto" }}>
                  {resultText}
                </pre>
              </div>
            )}
            {!resultText && tool.status === "running" && (
              <div style={{ padding: "6px 10px", color: "#9a6700", fontSize: 11 }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 6 }}>&#9881;</span>
                Running...
              </div>
            )}
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
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ background: "#ffffff", border: "1px solid #d0d7de", borderRadius: 4, color: "#cf222e", padding: "3px 8px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}
            >
              Clear
            </button>
          )}
          <span style={{ fontSize: 10, color: "#656d76" }}>{currentUser?.name}</span>
        </div>
      </div>

      {/* Restored history banner — makes it obvious previous chats were loaded */}
      {historyVisible && restoredCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px", background: "#ddf4ff", borderBottom: "1px solid #b6e3ff", fontSize: 11, color: "#0550ae" }}>
          <span>
            <strong>{"\u{1F4DA} Previous session restored"}</strong>{" \u00B7 "}{restoredCount} message{restoredCount === 1 ? "" : "s"} loaded from browser storage
          </span>
          <button
            onClick={() => setHistoryVisible(false)}
            style={{ background: "transparent", border: "none", color: "#0550ae", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

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

        {/* Live streaming pane — shown while a response is being generated */}
        {isLoading && (
          <div style={{ marginBottom: 16, borderLeft: "2px solid #0550ae", paddingLeft: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#1a7f37", textTransform: "uppercase", letterSpacing: "0.06em" }}>Azoox</span>
              <span style={{ fontSize: 9, color: "#afb8c1" }}>
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontSize: 9, color: "#9a6700", padding: "1px 6px", background: "#fff8c5", borderRadius: 99, border: "1px solid #eac54f" }}>streaming</span>
            </div>

            {/* Session info (model, cwd, tools) */}
            {sessionInfo && (
              <div style={{ background: "#f6f8fa", border: "1px solid #d0d7de", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 10, color: "#656d76", fontFamily: "'IBM Plex Mono', monospace" }}>
                <div><strong style={{ color: "#0550ae" }}>model:</strong> {sessionInfo.model || "?"}</div>
                {sessionInfo.cwd && <div><strong style={{ color: "#0550ae" }}>cwd:</strong> {sessionInfo.cwd}</div>}
                {sessionInfo.permission_mode && <div><strong style={{ color: "#0550ae" }}>mode:</strong> {sessionInfo.permission_mode}</div>}
                {sessionInfo.tools && sessionInfo.tools.length > 0 && (
                  <div><strong style={{ color: "#0550ae" }}>tools:</strong> {sessionInfo.tools.join(", ")}</div>
                )}
                {sessionInfo.session_id && <div style={{ fontSize: 9, color: "#8b949e", marginTop: 2 }}>session: {sessionInfo.session_id.slice(0, 8)}</div>}
              </div>
            )}

            {/* Status line */}
            {statusLine && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0550ae", fontSize: 11, marginBottom: 6 }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>
                {statusLine}
              </div>
            )}

            {/* Extended thinking (collapsible) */}
            {liveThinking && (
              <details open style={{ marginBottom: 6 }}>
                <summary style={{ fontSize: 10, color: "#8250df", cursor: "pointer", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {"\u{1F4AD} Thinking..."}
                </summary>
                <pre style={{ margin: "4px 0 0 0", padding: "6px 10px", background: "#fbf0ff", border: "1px solid #e7c6ff", borderRadius: 6, color: "#6639ba", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "'IBM Plex Mono', monospace", maxHeight: 180, overflowY: "auto" }}>
                  {liveThinking}
                </pre>
              </details>
            )}

            {/* Live tool events */}
            {toolEvents.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {toolEvents.map((tool, ti) => renderToolBlock(tool, "live", ti, true))}
              </div>
            )}

            {/* Live streaming text (before the final message is finalized) */}
            {liveText && messages[messages.length - 1]?._streaming !== true && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1f2328" }}>
                {renderContent(liveText)}
                <span style={{ display: "inline-block", width: 6, height: 14, background: "#0550ae", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s steps(2) infinite" }} />
              </div>
            )}

            {/* Fallback: nothing yet */}
            {!statusLine && !liveText && !liveThinking && toolEvents.length === 0 && !sessionInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#656d76", fontSize: 12 }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9881;</span>
                Waiting for Azoox...
              </div>
            )}
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
