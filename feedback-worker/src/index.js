function jsonResponse(payload, status = 200, origin = '*') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isNullOriginAllowed(env) {
  return String(env.ALLOW_NULL_ORIGIN || 'true').toLowerCase() === 'true';
}

function resolveCorsOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);
  if (!origin) return '*';
  if (origin === 'null' && isNullOriginAllowed(env)) return origin;
  if (!allowedOrigins.length) return origin;
  return allowedOrigins.includes(origin) ? origin : null;
}

function normalizeIssueTitle(message) {
  const firstLine = String(message || '').split('\n').find((line) => line.trim()) || 'Feedback';
  return `Feedback: ${firstLine.trim().slice(0, 72)}`;
}

function normalizeIssueBody(payload) {
  const message = String(payload.message || payload.body || '').trim();
  const context = payload.context || {};
  const details = [];
  if (context.hostMode) details.push(`Host mode: ${context.hostMode}`);
  if (context.workspaceLayout) details.push(`Workspace layout: ${context.workspaceLayout}`);
  if (context.activeTab) details.push(`Active tab: ${context.activeTab}`);
  if (context.timestamp) details.push(`Timestamp: ${context.timestamp}`);
  return [
    '## User Feedback',
    '',
    message,
    '',
    '---',
    '',
    '## App Context',
    ...details.map((item) => `- ${item}`),
    '',
    '---',
    '*This issue was automatically created from Bible Song Pro in-app feedback.*'
  ].join('\n').trim();
}

async function createGitHubIssue(env, payload) {
  const token = String(env.GITHUB_TOKEN || '').trim();
  const repo = String(env.GITHUB_REPO || '').trim();
  if (!token) throw new Error('Missing GITHUB_TOKEN secret.');
  if (!repo || !repo.includes('/')) throw new Error('Invalid GITHUB_REPO setting.');

  const message = String(payload.message || payload.body || '').trim();
  if (!message) throw new Error('Feedback message is required.');

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'Bible-Song-Pro-Feedback-Worker'
    },
    body: JSON.stringify({
      title: String(payload.title || '').trim() || normalizeIssueTitle(message),
      body: normalizeIssueBody(payload),
      labels: ['user-feedback']
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data && data.message ? String(data.message) : `GitHub API error (${response.status}).`);
  }
  return data;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsOrigin = resolveCorsOrigin(request, env);

    if (request.method === 'OPTIONS') {
      if (corsOrigin == null) return jsonResponse({ ok: false, error: 'Invalid origin' }, 403, 'null');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (corsOrigin == null) {
      return jsonResponse({ ok: false, error: 'Invalid origin' }, 403, 'null');
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        repo: String(env.GITHUB_REPO || ''),
        hasToken: !!String(env.GITHUB_TOKEN || '').trim()
      }, 200, corsOrigin);
    }

    if (request.method === 'POST' && url.pathname === '/api/github-feedback') {
      try {
        const payload = await request.json();
        const issue = await createGitHubIssue(env, payload || {});
        return jsonResponse({
          ok: true,
          issueUrl: issue.html_url,
          issueNumber: issue.number
        }, 200, corsOrigin);
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to create GitHub issue.'
        }, 400, corsOrigin);
      }
    }

    return jsonResponse({ ok: false, error: 'Not found.' }, 404, corsOrigin);
  }
};
