// Vercel serverless function: commit JSON files to the GitHub repo
// so admin saves propagate to the live site.
//
// Required env var (set in Vercel dashboard → Project → Settings → Environment Variables):
//   GITHUB_TOKEN  — fine-grained PAT with "Contents: read & write" on this repo
//   GITHUB_REPO   — optional, defaults to "majdiq1/ayla-marina"
//   GITHUB_BRANCH — optional, defaults to "main"

const ALLOWED_FILES = new Set(['pois.json', 'categories.json', 'settings.json', 'levels.json']);

export default async function handler(req, res) {
  // CORS for the admin UI (same origin in production, useful for local dev too)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'GITHUB_TOKEN not set. Open the Vercel dashboard → Project Settings → Environment Variables → add GITHUB_TOKEN (fine-grained PAT with Contents: read & write on this repo). Redeploy after.',
    });
  }
  const REPO   = process.env.GITHUB_REPO   || 'majdiq1/ayla-marina';
  const BRANCH = process.env.GITHUB_BRANCH || 'main';

  // Body should be { files: [{ file: 'pois.json', content: {...} }, ...] }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(_) { body = {}; } }
  const files = body?.files || (body?.file ? [{ file: body.file, content: body.content }] : []);
  if (!files.length) return res.status(400).json({ ok: false, error: 'Missing files[]' });
  for (const f of files) {
    if (!ALLOWED_FILES.has(f.file)) return res.status(400).json({ ok: false, error: `File not allowed: ${f.file}` });
  }

  const ghHeaders = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'ayla-admin-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const results = [];
  for (const f of files) {
    const path = `data/${f.file}`;
    const url  = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
    try {
      // Get current SHA (required by Contents API for updates)
      const cur = await fetch(url, { headers: ghHeaders });
      let sha;
      if (cur.ok) {
        const j = await cur.json();
        sha = j.sha;
      } else if (cur.status !== 404) {
        const err = await cur.text();
        results.push({ file: f.file, ok: false, status: cur.status, error: err.slice(0, 300) });
        continue;
      }
      const body64 = Buffer.from(JSON.stringify(f.content, null, 2), 'utf8').toString('base64');
      const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `admin sync: update ${f.file}`,
          content: body64,
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      const out = await put.json();
      if (!put.ok) {
        results.push({ file: f.file, ok: false, status: put.status, error: out.message || 'GitHub error' });
      } else {
        results.push({ file: f.file, ok: true, commit: out.commit?.sha, html_url: out.commit?.html_url });
      }
    } catch (e) {
      results.push({ file: f.file, ok: false, error: e.message });
    }
  }

  const allOk = results.every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({
    ok: allOk,
    files: results,
    note: allOk ? 'Committed. Vercel auto-deploys in ~30 seconds, then public site reflects changes.' : 'Some files failed — see per-file status.',
  });
}
