# Bible Song Pro Feedback Worker

Cloudflare Worker for receiving in-app feedback and creating GitHub issues.

## What It Does

- Accepts `POST /api/github-feedback`
- Uses a server-side GitHub token
- Creates an issue in `Johnbatey/bible-song-pro-obs`
- Returns the created issue URL to the app

## Prerequisites

- Cloudflare account
- Wrangler CLI login
- GitHub fine-grained token with:
  - repository: `Johnbatey/bible-song-pro-obs`
  - permission: `Issues: Read and write`

## Setup

1. Install dependencies

```bash
cd feedback-worker
npm install
```

2. Login to Cloudflare

```bash
npx wrangler login
```

3. Set the GitHub token secret

```bash
npx wrangler secret put GITHUB_TOKEN
```

4. Optional: adjust `wrangler.toml`

- `GITHUB_REPO`
- `ALLOWED_ORIGINS`
- `ALLOW_NULL_ORIGIN`

## Local Development

```bash
npm run dev
```

Local endpoints:

- `http://127.0.0.1:8787/health`
- `http://127.0.0.1:8787/api/github-feedback`

## Deploy

```bash
npm run deploy
```

Cloudflare will give you a public URL similar to:

```text
https://bible-song-pro-feedback.<your-subdomain>.workers.dev
```

Use this in the app feedback tab:

```text
https://bible-song-pro-feedback.<your-subdomain>.workers.dev/api/github-feedback
```

## Request Body

```json
{
  "title": "Feedback: Nice One",
  "body": "Nice One",
  "message": "Nice One",
  "context": {
    "hostMode": "obs",
    "workspaceLayout": "focused",
    "activeTab": "bible",
    "timestamp": "2026-03-28T12:00:00.000Z"
  }
}
```
