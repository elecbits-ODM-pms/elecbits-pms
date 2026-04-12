# Azoox Server

Backend for the Azoox AI dev assistant. Uses [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) with OAuth auth tied to your Claude Pro/Max subscription — no API credits needed.

## What it does
- Runs a Node.js Express server exposing `POST /chat`
- Each request spawns a Claude Agent SDK `query()` session with full tool access (Read, Write, Edit, Bash, Glob, Grep)
- The agent operates on a local git clone of `elecbits-ODM-pms/elecbits-pms`
- Commits and pushes directly via git/bash tools
- Streams NDJSON responses back to the webapp

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes* | OAuth token from `claude setup-token` (subscription auth) |
| `ANTHROPIC_API_KEY` | Yes* | Alternative to OAuth — API key with credits |
| `SHARED_SECRET` | Yes | Random string; webapp must send it in `x-azoox-secret` header |
| `GITHUB_TOKEN` | Yes | GitHub PAT with Contents read/write on the repo |
| `PORT` | No | Default 3000 |
| `WORKSPACE` | No | Default `/data/azoox-workspace` (inside container) |
| `REPO_URL` | No | Default `https://github.com/elecbits-ODM-pms/elecbits-pms.git` |

*One of `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` is required.

## Generate the OAuth token

On any machine where you're logged into Claude Code:

```bash
claude setup-token
```

This outputs a long-lived token starting with `sk-ant-oat01-...`. Save it.

## Local test

```bash
cd azoox-server
npm install
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
export SHARED_SECRET=$(openssl rand -hex 32)
export GITHUB_TOKEN=github_pat_...
npm start
```

In another terminal:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "x-azoox-secret: $SHARED_SECRET" \
  -d '{"messages":[{"role":"user","content":"list files in src/pages/"}],"branch":"main"}'
```

## Deploy to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up / log in: `fly auth login`
3. From the `azoox-server/` directory:

```bash
cd azoox-server

# First time only — creates the app
fly launch --no-deploy --copy-config

# Create persistent volume (keeps the git clone across restarts)
fly volumes create azoox_data --size 1 --region bom

# Set all secrets
fly secrets set \
  CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-... \
  SHARED_SECRET=$(openssl rand -hex 32) \
  GITHUB_TOKEN=github_pat_...

# Deploy
fly deploy
```

After deploy you'll get a URL like `https://azoox-server.fly.dev`. Test it:

```bash
curl https://azoox-server.fly.dev/health
```

## Wire into the webapp

Set these in your webapp `.env.local`:

```
VITE_AZOOX_URL=https://azoox-server.fly.dev
VITE_AZOOX_SECRET=<same value as SHARED_SECRET>
```

Then rebuild the webapp and the Dev Console will talk to Fly.io directly.
