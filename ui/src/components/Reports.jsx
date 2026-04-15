import { useState } from 'react'

function scoreColor(n) {
  if (n >= 4.0) return '#10b981'
  if (n >= 3.5) return '#22c55e'
  if (n >= 3.0) return '#f59e0b'
  if (n >= 2.0) return '#f97316'
  return '#ef4444'
}

export default function Reports({ data }) {
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const apps = (data.applications || [])
    .filter(a => a.reportFile)
    .sort((a, b) => (b.scoreNum ?? 0) - (a.scoreNum ?? 0))

  const filtered = apps.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.company?.toLowerCase().includes(q) || a.role?.toLowerCase().includes(q)
  })

  function openReport(app) {
    setSelected(app)
    setLoading(true)
    fetch(`/api/report?file=${encodeURIComponent(app.reportFile)}`)
      .then(r => r.text())
      .then(t => { setContent(t); setLoading(false) })
      .catch(() => { setContent('Failed to load report.'); setLoading(false) })
  }

  return (
    <div className="reports-layout">
      <div className="reports-sidebar">
        <input
          className="search"
          placeholder="Filter reports…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="reports-list">
          {filtered.map(a => (
            <button
              key={a.num}
              className={`report-item ${selected?.num === a.num ? 'active' : ''}`}
              onClick={() => openReport(a)}
            >
              <div className="report-item-top">
                <span className="report-company">{a.company}</span>
                {a.scoreNum != null && (
                  <span className="score-badge sm" style={{ background: scoreColor(a.scoreNum) }}>
                    {a.score}
                  </span>
                )}
              </div>
              <div className="report-item-role">{a.role}</div>
              <div className="report-item-meta">{a.date} · #{a.reportNum}</div>
            </button>
          ))}
          {filtered.length === 0 && <p className="empty-msg">No reports found.</p>}
        </div>
      </div>

      <div className="reports-viewer">
        {!selected && (
          <div className="center-msg muted">Select a report from the list</div>
        )}
        {selected && (
          <>
            <div className="viewer-header">
              <span>{selected.reportFile}</span>
            </div>
            <div className="viewer-body">
              {loading
                ? <div className="center-msg">Loading…</div>
                : <ReportMarkdown content={content} />
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReportMarkdown({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const hMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const Tag = `h${level}`
      elements.push(<Tag key={i}>{renderInline(hMatch[2])}</Tag>)
      i++; continue
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} />)
      i++; continue
    }

    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<TableBlock key={`t${i}`} lines={tableLines} />)
      continue
    }

    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^[-*]\s/, ''))}</li>)
        i++
      }
      elements.push(<ul key={`ul${i}`}>{items}</ul>)
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol${i}`}>{items}</ol>)
      continue
    }

    if (line.trim() === '') { i++; continue }

    elements.push(<p key={i}>{renderInline(line)}</p>)
    i++
  }

  return <div className="report-md">{elements}</div>
}

function TableBlock({ lines }) {
  const rows = lines
    .filter(l => !l.match(/^\|[-| :]+\|$/))
    .map(l => l.split('|').map(c => c.trim()).filter(Boolean))

  if (rows.length === 0) return null
  const [header, ...body] = rows
  return (
    <table className="report-table">
      <thead><tr>{header.map((c, i) => <th key={i}>{renderInline(c)}</th>)}</tr></thead>
      <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>)}</tbody>
    </table>
  )
}

function renderInline(text) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const s = m[0]
    if (s.startsWith('**')) parts.push(<strong key={m.index}>{s.slice(2, -2)}</strong>)
    else if (s.startsWith('*')) parts.push(<em key={m.index}>{s.slice(1, -1)}</em>)
    else if (s.startsWith('`')) parts.push(<code key={m.index}>{s.slice(1, -1)}</code>)
    else {
      const lm = s.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) parts.push(<a key={m.index} href={lm[2]} target="_blank" rel="noreferrer">{lm[1]}</a>)
    }
    last = m.index + s.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}
