const http = require('http');
const { URL } = require('url');

const PORT = Number.parseInt(process.env.FEEDBACK_PORT || '8787', 10);
const GITHUB_TOKEN = String(process.env.GITHUB_TOKEN || '').trim();
const GITHUB_REPO = String(process.env.GITHUB_REPO || 'Johnbatey/bible-song-pro-obs').trim();
const ALLOWED_ORIGIN = String(process.env.FEEDBACK_ALLOWED_ORIGIN || '*').trim() || '*';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeIssueTitle(title, message) {
  const fromTitle = String(title || '').trim();
  if (fromTitle) return fromTitle.slice(0, 120);
  const firstLine = String(message || '').split('\n').find((line) => line.trim()) || 'Feedback';
  return `Feedback: ${firstLine.trim().slice(0, 72)}`;
}

function normalizeIssueBody(body, message, context = {}) {
  const content = String(body || message || '').trim();
  const details = [];
  if (context.hostMode) details.push(`Host mode: ${context.hostMode}`);
  if (context.workspaceLayout) details.push(`Workspace layout: ${context.workspaceLayout}`);
  if (context.activeTab) details.push(`Active tab: ${context.activeTab}`);
  if (context.timestamp) details.push(`Timestamp: ${context.timestamp}`);
  const footer = details.length ? `\n\n---\n${details.join('\n')}` : '';
  return `${content}${footer}`.trim();
}

async function createGitHubIssue(payload) {
  if (!GITHUB_TOKEN) {
    throw new Error('Missing GITHUB_TOKEN on backend.');
  }
  if (!GITHUB_REPO || !GITHUB_REPO.includes('/')) {
    throw new Error('GITHUB_REPO must look like "owner/repo".');
  }

  const issueTitle = normalizeIssueTitle(payload.title, payload.message);
  const issueBody = normalizeIssueBody(payload.body, payload.message, payload.context);
  if (!issueBody) {
    throw new Error('Feedback message is required.');
  }

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'Bible-Song-Pro-Feedback-Backend',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody
    })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const githubError = json && json.message ? String(json.message) : `GitHub API request failed (${response.status}).`;
    throw new Error(githubError);
  }

  return {
    issueNumber: json.number,
    issueUrl: json.html_url
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      repo: GITHUB_REPO,
      hasToken: !!GITHUB_TOKEN
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/github-feedback') {
    try {
      const payload = await readJsonBody(req);
      const result = await createGitHubIssue(payload);
      sendJson(res, 200, {
        ok: true,
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error && error.message ? String(error.message) : 'Unable to create GitHub issue.'
      });
    }
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Not found.'
  });
});

server.listen(PORT, () => {
  console.log(`[feedback-backend] listening on http://127.0.0.1:${PORT}`);
  console.log(`[feedback-backend] repo: ${GITHUB_REPO}`);
  console.log(`[feedback-backend] token: ${GITHUB_TOKEN ? 'configured' : 'missing'}`);
});
