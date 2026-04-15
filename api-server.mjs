import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseApplications() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data/applications.md'), 'utf8');
    const apps = [];
    let inTable = false;
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('|') || !t.endsWith('|')) continue;
      const cells = t.split('|').map(c => c.trim()).filter(Boolean);
      if (cells[0] === '#' || cells[0].startsWith('---')) { inTable = true; continue; }
      if (!inTable || cells.length < 9) continue;
      const [num, date, company, role, score, status, pdf, report, ...notesParts] = cells;
      const reportMatch = report.match(/\[(\d+)\]\(reports\/([^)]+)\)/);
      const scoreMatch = score.match(/(\d+\.?\d*)/);
      apps.push({
        num: parseInt(num, 10), date, company, role, score,
        scoreNum: scoreMatch ? parseFloat(scoreMatch[1]) : null,
        status, pdf, report,
        reportFile: reportMatch ? reportMatch[2] : null,
        reportNum: reportMatch ? reportMatch[1] : null,
        notes: notesParts.join(' | '),
      });
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
        processed.push({
          raw: content,
          num: parts[0] ? parts[0].replace('#', '') : null,
          url: urlMatch ? urlMatch[0].replace(/\s.*$/, '') : null,
          company: parts[2] || null, role: parts[3] || null,
          score: parts[4] || null, action: parts[5] || null,
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

function parseProfileFull() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'config/profile.yml'), 'utf8');
    const get = re => { const m = raw.match(re); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
    const getList = re => {
      const m = raw.match(re);
      if (!m) return [];
      return m[1].match(/- (.+)/g)?.map(r => r.replace(/^- /, '').replace(/^["']|["']$/g, '').trim()) || [];
    };
    return {
      full_name: get(/full_name:\s*["']?([^"'\n]+)/),
      email: get(/email:\s*["']?([^"'\n]+)/),
      phone: get(/phone:\s*["']?([^"'\n]+)/),
      location: get(/location:\s*["']?([^"'\n]+)/),
      linkedin: get(/linkedin:\s*["']?([^"'\n]+)/),
      github: get(/github:\s*["']?([^"'\n]+)/),
      target_range: get(/target_range:\s*["']?([^"'\n]+)/),
      minimum: get(/minimum:\s*["']?([^"'\n]+)/),
      location_flexibility: get(/location_flexibility:\s*["']?([^"'\n]+)/),
      headline: get(/headline:\s*["']?([^"'\n]+)/),
      exit_story: get(/exit_story:\s*["']?([^"'\n]+)/),
      timeline: get(/timeline:\s*["']?([^"'\n]+)/),
      primary_roles: getList(/primary:\s*\n((?:\s+- [^\n]+\n?)+)/),
      preferred_companies: getList(/preferred:\s*\n((?:\s+- [^\n]+\n?)+)/),
      hard_no: getList(/hard_no:\s*\n((?:\s+- [^\n]+\n?)+)/),
      energizing: getList(/energizing:\s*\n((?:\s+- [^\n]+\n?)+)/),
      draining: getList(/draining:\s*\n((?:\s+- [^\n]+\n?)+)/),
    };
  } catch { return {}; }
}

function computeStats(apps) {
  const total = apps.length;
  const applied = apps.filter(a => a.status === 'Applied').length;
  const interview = apps.filter(a => a.status === 'Interview').length;
  const offer = apps.filter(a => a.status === 'Offer').length;
  const skip = apps.filter(a => a.status === 'SKIP').length;
  const scores = apps.filter(a => a.scoreNum !== null).map(a => a.scoreNum);
  const avgScore = scores.length
    ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(2) : '0.00';
  return { total, applied, interview, offer, skip, avgScore };
}

// ─── Pipeline writer ──────────────────────────────────────────────────────────

function addUrlsToPipeline(urls) {
  const filePath = path.join(__dirname, 'data/pipeline.md');
  let raw = '';
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { }

  // Find ## Pending section and inject after it
  const pendingMarker = '## Pending';
  const emptyComment = '<!-- Inbox is empty — run /career-ops scan to find new offers -->';
  const newLines = urls.map(u => `- [ ] ${u.trim()}`).join('\n');

  if (raw.includes(emptyComment)) {
    raw = raw.replace(emptyComment, newLines);
  } else if (raw.includes(pendingMarker)) {
    // Insert after the ## Pending heading
    raw = raw.replace(pendingMarker, `${pendingMarker}\n\n${newLines}`);
  } else {
    raw += `\n\n## Pending\n\n${newLines}\n`;
  }

  fs.writeFileSync(filePath, raw, 'utf8');
}

// ─── Profile writer ───────────────────────────────────────────────────────────

function updateProfileField(raw, key, value) {
  // Replace a simple key: "value" line
  const re = new RegExp(`(${key}:\\s*)["']?[^"'\\n]+["']?`);
  const replacement = `$1"${value}"`;
  return raw.match(re) ? raw.replace(re, replacement) : raw;
}

function updateProfileList(raw, sectionKey, items) {
  // Replace a list under a key like `primary:` or `hard_no:`
  const listStr = items.map(i => `    - "${i}"`).join('\n');
  const re = new RegExp(`(${sectionKey}:\\s*\\n)(?:\\s+- [^\\n]+\\n?)+`);
  return raw.match(re)
    ? raw.replace(re, `$1${listStr}\n`)
    : raw;
}

// ─── Multipart parser (for resume upload) ────────────────────────────────────

function parseMultipart(buffer, boundary) {
  const files = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = 0;

  while (start < buffer.length) {
    const bStart = buffer.indexOf(boundaryBuf, start);
    if (bStart === -1) break;
    const afterBoundary = bStart + boundaryBuf.length;
    if (buffer[afterBoundary] === 45 && buffer[afterBoundary + 1] === 45) break; // '--'

    const headerEnd = buffer.indexOf('\r\n\r\n', afterBoundary);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(afterBoundary + 2, headerEnd).toString();
    const nextBoundary = buffer.indexOf(boundaryBuf, headerEnd + 4);
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2;
    const data = buffer.slice(headerEnd + 4, dataEnd);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (filenameMatch) {
      files.push({
        fieldname: nameMatch?.[1] || 'file',
        filename: filenameMatch[1],
        data,
      });
    }
    start = nextBoundary === -1 ? buffer.length : nextBoundary;
  }
  return files;
}

// ─── Request handler ──────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── GET /api/data ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/data') {
    const apps = parseApplications();
    json(res, {
      applications: apps,
      pipeline: parsePipeline(),
      profile: parseProfileFull(),
      stats: computeStats(apps),
    });
    return;
  }

  // ── GET /api/report ────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/report') {
    const file = url.searchParams.get('file');
    if (!file || file.includes('..') || file.includes('/')) {
      res.writeHead(400); res.end('Bad request'); return;
    }
    try {
      const content = fs.readFileSync(path.join(__dirname, 'reports', file), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
    return;
  }

  // ── GET /api/cv ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/cv') {
    try {
      const content = fs.readFileSync(path.join(__dirname, 'cv.md'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch { res.writeHead(404); res.end('cv.md not found'); }
    return;
  }

  // ── POST /api/cv ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/cv') {
    try {
      const body = await readBody(req);
      const { content } = JSON.parse(body.toString());
      if (typeof content !== 'string') { json(res, { error: 'content required' }, 400); return; }
      fs.writeFileSync(path.join(__dirname, 'cv.md'), content, 'utf8');
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 500); }
    return;
  }

  // ── GET /api/profile/full ──────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/profile/full') {
    try {
      const raw = fs.readFileSync(path.join(__dirname, 'config/profile.yml'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(raw);
    } catch { res.writeHead(404); res.end('profile.yml not found'); }
    return;
  }

  // ── POST /api/profile ──────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/profile') {
    try {
      const body = await readBody(req);
      const fields = JSON.parse(body.toString());
      let raw = fs.readFileSync(path.join(__dirname, 'config/profile.yml'), 'utf8');

      // Simple scalar fields
      const scalarMap = {
        full_name: 'full_name', email: 'email', phone: 'phone',
        location: 'location', linkedin: 'linkedin', github: 'github',
        target_range: 'target_range', minimum: 'minimum',
        location_flexibility: 'location_flexibility',
        headline: 'headline', exit_story: 'exit_story', timeline: 'timeline',
      };
      for (const [k, ymlKey] of Object.entries(scalarMap)) {
        if (fields[k] !== undefined) raw = updateProfileField(raw, ymlKey, fields[k]);
      }

      // List fields
      const listMap = {
        primary_roles: 'primary',
        preferred_companies: 'preferred',
        hard_no: 'hard_no',
        energizing: 'energizing',
        draining: 'draining',
      };
      for (const [k, ymlKey] of Object.entries(listMap)) {
        if (Array.isArray(fields[k])) raw = updateProfileList(raw, ymlKey, fields[k]);
      }

      fs.writeFileSync(path.join(__dirname, 'config/profile.yml'), raw, 'utf8');
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 500); }
    return;
  }

  // ── POST /api/resume ───────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/resume') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (!boundaryMatch) { json(res, { error: 'No boundary in multipart' }, 400); return; }

      const buffer = await readBody(req);
      const files = parseMultipart(buffer, boundaryMatch[1]);

      if (!files.length) { json(res, { error: 'No file found' }, 400); return; }

      const file = files[0];
      const ext = path.extname(file.filename).toLowerCase();
      const allowed = ['.pdf', '.md', '.txt', '.docx'];
      if (!allowed.includes(ext)) { json(res, { error: 'Unsupported file type' }, 400); return; }

      const saveName = `resume-upload-${Date.now()}${ext}`;
      const savePath = path.join(__dirname, saveName);
      fs.writeFileSync(savePath, file.data);

      json(res, { ok: true, filename: saveName, originalName: file.filename, size: file.data.length });
    } catch (e) { json(res, { error: e.message }, 500); }
    return;
  }

  // ── POST /api/pipeline/add ────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/pipeline/add') {
    try {
      const body = await readBody(req);
      const { urls } = JSON.parse(body.toString());
      if (!Array.isArray(urls) || !urls.length) { json(res, { error: 'urls array required' }, 400); return; }
      const valid = urls.filter(u => /^https?:\/\//.test(u.trim()));
      if (!valid.length) { json(res, { error: 'No valid URLs' }, 400); return; }
      addUrlsToPipeline(valid);
      json(res, { ok: true, added: valid.length });
    } catch (e) { json(res, { error: e.message }, 500); }
    return;
  }

  // ── GET /api/open ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/open') {
    const target = url.searchParams.get('url');
    if (target && /^https?:\/\//.test(target)) {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} "${target.replace(/"/g, '\\"')}"`);
    }
    json(res, { ok: true });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`career-ops API  →  http://localhost:${PORT}`);
});
