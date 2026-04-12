// Dev Console — Agentic AI assistant with GitHub tools
// Streams SSE events: text, tool_start, tool_result, done, error

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const REPO_OWNER = "elecbits-ODM-pms";
const REPO_NAME = "elecbits-pms";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const MAX_ITERATIONS = 15;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── TOOL DEFINITIONS (Claude API format) ────────────────────────
const tools = [
  {
    name: "list_files",
    description: "List files and directories at a given path in the repository. Returns name, type (file/dir), size, and path for each entry.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path relative to repo root. Use '' or '.' for root." },
        branch: { type: "string", description: "Branch name. Defaults to 'main'." },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file from the repository. Returns the decoded text content. For large files, content may be truncated to first 500 lines.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to repo root." },
        branch: { type: "string", description: "Branch name. Defaults to 'main'." },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search for code across the repository using GitHub code search. Returns matching file paths and text fragments.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query. Supports GitHub code search syntax." },
      },
      required: ["query"],
    },
  },
  {
    name: "create_or_update_file",
    description: "Create a new file or update an existing file in the repository. Automatically creates a commit. For updates, fetches the current SHA automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to repo root." },
        content: { type: "string", description: "The full new content of the file (plain text, not base64)." },
        message: { type: "string", description: "Commit message for this change." },
        branch: { type: "string", description: "Branch to commit to. Defaults to 'main'." },
      },
      required: ["path", "content", "message"],
    },
  },
  {
    name: "create_branch",
    description: "Create a new branch from an existing branch (defaults to 'main').",
    input_schema: {
      type: "object" as const,
      properties: {
        branch_name: { type: "string", description: "Name of the new branch to create." },
        from_branch: { type: "string", description: "Source branch. Defaults to 'main'." },
      },
      required: ["branch_name"],
    },
  },
  {
    name: "list_branches",
    description: "List all branches in the repository.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "git_push",
    description: "Files are auto-pushed when using create_or_update_file (GitHub Contents API commits directly to the remote). Use this tool only to confirm the latest commits on a branch.",
    input_schema: {
      type: "object" as const,
      properties: {
        branch: { type: "string", description: "Branch to check. Defaults to 'main'." },
      },
      required: [],
    },
  },
];

// ─── SYSTEM PROMPT ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Azoox, an AI development assistant embedded in the Elecbits PMS (Project Management System) webapp. You have full access to the GitHub repository: ${REPO_OWNER}/${REPO_NAME}.

## Tech Stack
- Frontend: React 19 + Vite (no SSR, pure SPA)
- Backend: Supabase (Postgres DB, Auth, Edge Functions in Deno/TypeScript)
- Styling: All inline styles (no CSS files), IBM Plex Mono for code
- APIs: Anthropic Claude API, Google Sheets/Drive/Docs APIs
- Key files: src/App.jsx (main), src/lib/constants.jsx (config), src/lib/supabase.js (client)

## Your Capabilities
- Read any file in the repo
- List directory contents
- Search code across the entire codebase
- Create or edit files (auto-commits to the specified branch)
- Create branches
- List branches

## Guidelines
- ALWAYS read a file before editing it — never guess at contents
- Prefer creating feature branches for changes, not committing directly to main unless asked
- Keep responses concise and code-focused
- When editing files, provide the COMPLETE new file content (the tool replaces the entire file)
- Explain what you're doing and why as you work
- If a task is risky (force push, deleting files), warn the user first`;

// ─── GITHUB API HELPERS ──────────────────────────────────────────
async function githubFetch(path: string, options: RequestInit = {}) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const url = path.startsWith("https://") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "list_files": {
        const path = (input.path as string) || "";
        const branch = (input.branch as string) || "main";
        const cleanPath = path === "." || path === "/" ? "" : path;
        const res = await githubFetch(`/contents/${cleanPath}?ref=${branch}`);
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        if (!Array.isArray(data)) return `Error: Path is a file, not a directory. Use read_file instead.`;
        const listing = data.map((f: { name: string; type: string; size: number; path: string }) =>
          `${f.type === "dir" ? "[dir]" : `[${f.size}B]`}  ${f.path}`
        ).join("\n");
        return `${data.length} entries in ${cleanPath || "/"}:\n${listing}`;
      }

      case "read_file": {
        const path = input.path as string;
        const branch = (input.branch as string) || "main";
        const res = await githubFetch(`/contents/${path}?ref=${branch}`);
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        if (data.type === "dir") return `Error: Path is a directory. Use list_files instead.`;
        const decoded = atob(data.content.replace(/\n/g, ""));
        const lines = decoded.split("\n");
        const truncated = lines.length > 500;
        const content = truncated ? lines.slice(0, 500).join("\n") : decoded;
        return `File: ${path} (${data.size} bytes, ${lines.length} lines${truncated ? ", truncated to 500 lines" : ""}):\n\`\`\`\n${content}\n\`\`\``;
      }

      case "search_code": {
        const query = input.query as string;
        const res = await githubFetch(`https://api.github.com/search/code?q=${encodeURIComponent(query + " repo:" + REPO_OWNER + "/" + REPO_NAME)}&per_page=15`);
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        if (!data.items?.length) return "No results found.";
        const results = data.items.map((item: { path: string; html_url: string; text_matches?: { fragment: string }[] }) => {
          const fragments = item.text_matches?.map((m: { fragment: string }) => m.fragment).join("\n  ...") || "";
          return `${item.path}${fragments ? "\n  " + fragments : ""}`;
        }).join("\n\n");
        return `${data.total_count} results (showing ${data.items.length}):\n${results}`;
      }

      case "create_or_update_file": {
        const path = input.path as string;
        const content = input.content as string;
        const message = input.message as string;
        const branch = (input.branch as string) || "main";

        // Check if file exists to get SHA
        let sha: string | undefined;
        const checkRes = await githubFetch(`/contents/${path}?ref=${branch}`);
        if (checkRes.ok) {
          const existing = await checkRes.json();
          sha = existing.sha;
        }

        const body: Record<string, unknown> = {
          message,
          content: btoa(unescape(encodeURIComponent(content))),
          branch,
        };
        if (sha) body.sha = sha;

        const res = await githubFetch(`/contents/${path}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        return `${sha ? "Updated" : "Created"} ${path} on branch '${branch}'.\nCommit: ${data.commit.sha.slice(0, 7)} — ${message}`;
      }

      case "create_branch": {
        const branchName = input.branch_name as string;
        const fromBranch = (input.from_branch as string) || "main";

        // Get SHA of source branch
        const refRes = await githubFetch(`/git/refs/heads/${fromBranch}`);
        if (!refRes.ok) return `Error: Source branch '${fromBranch}' not found — ${await refRes.text()}`;
        const refData = await refRes.json();
        const sha = refData.object.sha;

        const res = await githubFetch(`/git/refs`, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
        });
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        return `Branch '${branchName}' created from '${fromBranch}' at ${sha.slice(0, 7)}.`;
      }

      case "list_branches": {
        const res = await githubFetch(`/branches?per_page=30`);
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        return `${data.length} branches:\n${data.map((b: { name: string; commit: { sha: string } }) => `  ${b.name} (${b.commit.sha.slice(0, 7)})`).join("\n")}`;
      }

      case "git_push": {
        const branch = (input.branch as string) || "main";
        const res = await githubFetch(`/commits?sha=${branch}&per_page=5`);
        if (!res.ok) return `Error: ${res.status} — ${await res.text()}`;
        const data = await res.json();
        return `Latest commits on '${branch}':\n${data.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } } }) =>
          `  ${c.sha.slice(0, 7)} ${c.commit.message.split("\n")[0]} (${c.commit.author.name}, ${c.commit.author.date.slice(0, 10)})`
        ).join("\n")}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool execution error: ${(err as Error).message}`;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, branch } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing required field: messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE events back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          let currentMessages = messages.map((m: { role: string; content: unknown }) => ({
            role: m.role,
            content: m.content,
          }));

          const systemWithBranch = `${SYSTEM_PROMPT}\n\nCurrent working branch: ${branch || "main"}`;

          for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            // Call Claude API (non-streaming for simplicity in agentic loop)
            const claudeRes = await fetch(ANTHROPIC_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 8192,
                system: systemWithBranch,
                tools,
                messages: currentMessages,
              }),
            });

            if (!claudeRes.ok) {
              const err = await claudeRes.text();
              send({ type: "error", content: `Claude API error: ${err}` });
              break;
            }

            const result = await claudeRes.json();
            const contentBlocks = result.content || [];

            // Extract text and tool_use blocks
            const textBlocks = contentBlocks.filter((b: { type: string }) => b.type === "text");
            const toolBlocks = contentBlocks.filter((b: { type: string }) => b.type === "tool_use");

            // Stream text blocks
            for (const block of textBlocks) {
              send({ type: "text", content: block.text });
            }

            // If no tool calls, we're done
            if (toolBlocks.length === 0 || result.stop_reason === "end_turn") {
              send({ type: "done" });
              break;
            }

            // Execute tool calls
            const toolResults = [];
            for (const toolBlock of toolBlocks) {
              send({ type: "tool_start", name: toolBlock.name, input: toolBlock.input });

              const toolResult = await executeTool(toolBlock.name, toolBlock.input);

              send({ type: "tool_result", name: toolBlock.name, result: toolResult.slice(0, 200) + (toolResult.length > 200 ? "..." : "") });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: toolResult,
              });
            }

            // Append assistant message + tool results for next iteration
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: contentBlocks },
              { role: "user", content: toolResults },
            ];
          }
        } catch (err) {
          const send2 = (event: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };
          send2({ type: "error", content: (err as Error).message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
