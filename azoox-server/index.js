// Azoox — AI dev assistant backend
// Uses Claude Agent SDK with OAuth (Claude Pro/Max subscription)
// Operates on a local git clone of elecbits-ODM-pms/elecbits-pms

import express from "express";
import cors from "cors";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PORT = process.env.PORT || 3000;
const SHARED_SECRET = process.env.SHARED_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_URL = process.env.REPO_URL || "https://github.com/elecbits-ODM-pms/elecbits-pms.git";
const WORKSPACE = process.env.WORKSPACE || "/tmp/azoox-workspace";

if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: Either CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY must be set");
  process.exit(1);
}
if (!SHARED_SECRET) {
  console.error("ERROR: SHARED_SECRET must be set");
  process.exit(1);
}
if (!GITHUB_TOKEN) {
  console.error("ERROR: GITHUB_TOKEN must be set");
  process.exit(1);
}

// ─── REPO SETUP ──────────────────────────────────────────────────
function setupRepo() {
  const authUrl = REPO_URL.replace("https://", `https://x-access-token:${GITHUB_TOKEN}@`);

  if (!fs.existsSync(WORKSPACE)) {
    console.log(`[setup] Cloning repo into ${WORKSPACE}...`);
    execSync(`git clone ${authUrl} ${WORKSPACE}`, { stdio: "inherit" });
  } else {
    console.log(`[setup] Repo exists, pulling latest...`);
    try {
      execSync(`git -C ${WORKSPACE} fetch --all`, { stdio: "inherit" });
      execSync(`git -C ${WORKSPACE} reset --hard origin/main`, { stdio: "inherit" });
      execSync(`git -C ${WORKSPACE} clean -fd`, { stdio: "inherit" });
    } catch (e) {
      console.error("[setup] Pull failed, re-cloning...");
      fs.rmSync(WORKSPACE, { recursive: true, force: true });
      execSync(`git clone ${authUrl} ${WORKSPACE}`, { stdio: "inherit" });
    }
  }

  // Configure git identity for commits
  execSync(`git -C ${WORKSPACE} config user.name "Azoox AI"`, { stdio: "inherit" });
  execSync(`git -C ${WORKSPACE} config user.email "azoox@elecbits.in"`, { stdio: "inherit" });

  // Set remote with auth for push operations
  execSync(`git -C ${WORKSPACE} remote set-url origin ${authUrl}`, { stdio: "inherit" });

  console.log(`[setup] Repo ready at ${WORKSPACE}`);
}

setupRepo();

// ─── EXPRESS APP ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", workspace: WORKSPACE });
});

// Auth middleware
function requireSecret(req, res, next) {
  const provided = req.headers["x-azoox-secret"];
  if (provided !== SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── CHAT ENDPOINT (NDJSON STREAM) ────────────────────────────────
app.post("/chat", requireSecret, async (req, res) => {
  const { messages, branch } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing messages array" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const write = (obj) => {
    try { res.write(JSON.stringify(obj) + "\n"); } catch (_) {}
  };

  try {
    // Pull latest before each chat to stay in sync with main
    try {
      execSync(`git -C ${WORKSPACE} fetch origin`, { stdio: "pipe" });
      execSync(`git -C ${WORKSPACE} reset --hard origin/${branch || "main"}`, { stdio: "pipe" });
    } catch (e) {
      console.warn("[chat] Sync warning:", e.message);
    }

    // Build a single prompt from the full message history
    // Claude Agent SDK takes a single prompt, so we concatenate the conversation
    const conversationContext = messages
      .map((m) => {
        const role = m.role === "user" ? "User" : "Assistant";
        return `${role}: ${m.content}`;
      })
      .join("\n\n");

    const systemPrompt = `You are Azoox, an AI development assistant for the Elecbits PMS (Project Management System) codebase.

You are operating on a git clone at ${WORKSPACE}. The repo is elecbits-ODM-pms/elecbits-pms.

Tech stack:
- Frontend: React 19 + Vite (no SSR, pure SPA)
- Backend: Supabase (Postgres DB, Auth, Edge Functions in Deno/TypeScript)
- Styling: All inline styles (no CSS files), IBM Plex Mono for code
- Key files: src/App.jsx (main), src/lib/constants.jsx (config), src/lib/supabase.js (client)

Current working branch: ${branch || "main"}

Guidelines:
- Always read files before editing them
- Use git commands via Bash to commit and push your changes
- Prefer feature branches over committing directly to main
- Run 'npx vite build' after significant changes to verify they compile
- Keep responses concise and code-focused
- When pushing, use: git add <files> && git commit -m "msg" && git push origin <branch>`;

    const fullPrompt = `${systemPrompt}\n\n${conversationContext}\n\nAssistant:`;

    // Run agent with full tool access
    for await (const message of query({
      prompt: fullPrompt,
      options: {
        cwd: WORKSPACE,
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        includePartialMessages: true,
        permissionMode: "bypassPermissions",
      },
    })) {
      // Forward each SDK message as an NDJSON line
      write(message);
    }

    write({ type: "done" });
  } catch (err) {
    console.error("[chat] Error:", err);
    write({ type: "error", error: err.message || String(err) });
  } finally {
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[azoox] Server listening on :${PORT}`);
  console.log(`[azoox] Workspace: ${WORKSPACE}`);
  console.log(`[azoox] Auth: ${process.env.CLAUDE_CODE_OAUTH_TOKEN ? "OAuth (subscription)" : "API key"}`);
});
