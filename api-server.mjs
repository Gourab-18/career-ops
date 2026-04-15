import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseApplications() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data/applications.md'), 'utf8');
    const lines = raw.split('\n');
    const apps = [];
    let inTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        if (cells[0] === '#' || cells[0].startsWith('---')) { inTable = true; continue; }
        if (!inTable) continue;
        if (cells.length < 9) continue;
        const [num, date, company, role, score, status, pdf, report, ...notesParts] = cells;
        const notes = notesParts.join(' | ');
        const reportMatch = report.match(/\[(\d+)\]\(reports\/([^)]+)\)/);
        const scoreMatch = score.match(/(\d+\.?\d*)/);
        apps.push({
          num: parseInt(num, 10),
          date, company, role, score,
          scoreNum: scoreMatch ? parseFloat(scoreMatch[1]) : null,
          status, pdf, report,
          reportFile: reportMatch ? reportMatch[2] : null,
          reportNum: reportMatch ? reportMatch[1] : null,
          notes,
        });
      }
    }
    return apps;
  } catch { return []; }
}

function parsePipeline() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data/pipeline.md'), 'utf8');
    const pending = [], processed = [], errors = [];
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (t.startsWith('- [ ]')) {
        const content = t.slice(5).trim();
        const urlMatch = content.match(/https?:\/\/\S+/);
        pending.push({ raw: content, url: urlMatch ? urlMatch[0] : null });
      } else if (t.startsWith('- [x]') || t.startsWith('- [X]')) {
        const content = t.slice(5).trim();
        const parts = content.split('|').map(p => p.trim());
        const urlMatch = content.match(/https?:\/\/\S+/);
        // parts: #num | url | company | role | score | action
        processed.push({
          raw: content,
          num: parts[0] ? parts[0].replace('#', '') : null,
          url: urlMatch ? urlMatch[0].replace(/\s.*$/, '') : null,
          company: parts[2] || null,
          role: parts[3] || null,
          score: parts[4] || null,
          action: parts[5] || null,
        });
      } else if (t.startsWith('- [!]')) {
        const content = t.slice(5).trim();
        const urlMatch = content.match(/https?:\/\/\S+/);
        errors.push({ raw: content, url: urlMatch ? urlMatch[0].replace(/\s.*$/, '') : null });
      }
    }
    return { pending, processed, errors };
  } catch { return { pending: [], processed: [], errors: [] }; }
}

function parseProfile() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'config/profile.yml'), 'utf8');
    const get = (re) => { const m = raw.match(re); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
    const primarySection = raw.match(/primary:\s*\n((?:\s+- [^\n]+\n?)+)/);
    const primaryRoles = primarySection
      ? primarySection[1].match(/- (.+)/g).map(r => r.replace('- ', '').replace(/["']/g, '').trim())
      : [];
    return {
      name: get(/full_name:\s*["']?([^"'\n]+)/),
      email: get(/email:\s*["']?([^"'\n]+)/),
      location: get(/location:\s*["']?([^"'\n]+)/),
      targetRange: get(/target_range:\s*["']?([^"'\n]+)/),
      primaryRoles,
    };
  } catch { return { name: '', email: '', location: '', targetRange: '', primaryRoles: [] }; }
}

function computeStats(apps) {
  const total = apps.length;
  const applied = apps.filter(a => a.status === 'Applied').length;
  const interview = apps.filter(a => a.status === 'Interview').length;
  const offer = apps.filter(a => a.status === 'Offer').length;
  const skip = apps.filter(a => a.status === 'SKIP').length;
  const scores = apps.filter(a => a.scoreNum !== null).map(a => a.scoreNum);
  const avgScore = scores.length
    ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(2)
    : '0.00';
  return { total, applied, interview, offer, skip, avgScore };
}

// ─── Request handler ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for Vite dev server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /api/data — full dashboard payload
  if (url.pathname === '/api/data') {
    const apps = parseApplications();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      applications: apps,
      pipeline: parsePipeline(),
      profile: parseProfile(),
      stats: computeStats(apps),
    }));
    return;
  }

  // GET /api/report?file=001-earnin-2026-04-15.md
  if (url.pathname === '/api/report') {
    const file = url.searchParams.get('file');
    if (!file || file.includes('..') || file.includes('/')) {
      res.writeHead(400); res.end('Bad request'); return;
    }
    const filePath = path.join(__dirname, 'reports', file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // GET /api/open?url=https://...
  if (url.pathname === '/api/open') {
    const target = url.searchParams.get('url');
    if (target && /^https?:\/\//.test(target)) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} "${target.replace(/"/g, '\\"')}"`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`career-ops API server running at http://localhost:${PORT}`);
  console.log('Waiting for requests from the React UI...');
});
