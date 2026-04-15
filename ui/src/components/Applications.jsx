import { useState } from 'react'

const STATUS_COLORS = {
  'Applied': '#3b82f6',
  'Interview': '#8b5cf6',
  'Offer': '#10b981',
  'Rejected': '#ef4444',
  'SKIP': '#6b7280',
  'Discarded': '#6b7280',
  'Evaluated': '#f59e0b',
  'Responded': '#06b6d4',
}

function scoreColor(n) {
  if (n >= 4.0) return '#10b981'
  if (n >= 3.5) return '#22c55e'
  if (n >= 3.0) return '#f59e0b'
  if (n >= 2.0) return '#f97316'
  return '#ef4444'
}

function openUrl(url) {
  fetch(`/api/open?url=${encodeURIComponent(url)}`).catch(() => {
    window.open(url, '_blank')
  })
}

export default function Applications({ data }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportContent, setReportContent] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [sortKey, setSortKey] = useState('scoreNum')
  const [sortDir, setSortDir] = useState('desc')

  const apps = data.applications || []

  const statuses = ['all', ...new Set(apps.map(a => a.status).filter(Boolean))]

  const filtered = apps
    .filter(a => {
      if (filter !== 'all' && a.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.company?.toLowerCase().includes(q) ||
          a.role?.toLowerCase().includes(q) ||
          a.notes?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  function sort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function arrow(key) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  function openReport(file) {
    setSelectedReport(file)
    setReportLoading(true)
    fetch(`/api/report?file=${encodeURIComponent(file)}`)
      .then(r => r.text())
      .then(t => { setReportContent(t); setReportLoading(false) })
      .catch(() => { setReportContent('Failed to load report.'); setReportLoading(false) })
  }

  return (
    <div className="tab-content">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search company, role, notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-pills">
          {statuses.map(s => (
            <button
              key={s}
              className={`pill ${filter === s ? 'active' : ''}`}
              style={filter === s && s !== 'all' ? { background: STATUS_COLORS[s] || '#4b5563', color: '#fff' } : {}}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => sort('num')} style={{cursor:'pointer'}}>#{ arrow('num')}</th>
              <th onClick={() => sort('date')} style={{cursor:'pointer'}}>Date{arrow('date')}</th>
              <th onClick={() => sort('company')} style={{cursor:'pointer'}}>Company{arrow('company')}</th>
              <th onClick={() => sort('role')} style={{cursor:'pointer'}}>Role{arrow('role')}</th>
              <th onClick={() => sort('scoreNum')} style={{cursor:'pointer'}}>Score{arrow('scoreNum')}</th>
              <th onClick={() => sort('status')} style={{cursor:'pointer'}}>Status{arrow('status')}</th>
              <th>PDF</th>
              <th>Report</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.num}>
                <td className="num-cell">{a.num}</td>
                <td className="date-cell">{a.date}</td>
                <td className="company-cell"><strong>{a.company}</strong></td>
                <td className="role-cell">{a.role}</td>
                <td className="score-cell">
                  {a.scoreNum != null && (
                    <span className="score-badge" style={{ background: scoreColor(a.scoreNum) }}>
                      {a.score}
                    </span>
                  )}
                </td>
                <td>
                  <span className="status-badge" style={{ background: STATUS_COLORS[a.status] || '#4b5563' }}>
                    {a.status}
                  </span>
                </td>
                <td className="center-cell">{a.pdf}</td>
                <td className="center-cell">
                  {a.reportFile ? (
                    <button className="link-btn" onClick={() => openReport(a.reportFile)}>
                      #{a.reportNum}
                    </button>
                  ) : '—'}
                </td>
                <td className="notes-cell">{a.notes}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="empty-row">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>{selectedReport}</span>
              <button className="close-btn" onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            <div className="modal-body">
              {reportLoading
                ? <div className="center-msg">Loading…</div>
                : <ReportMarkdown content={reportContent} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportMarkdown({ content }) {
  // Simple markdown renderer — headings, bold, tables, lists, horizontal rules
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const Tag = `h${level}`
      elements.push(<Tag key={i}>{renderInline(hMatch[2])}</Tag>)
      i++; continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} />)
      i++; continue
    }

    // Table block
    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<TableBlock key={`t${i}`} lines={tableLines} />)
      continue
    }

    // List item
    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^[-*]\s/, ''))}</li>)
        i++
      }
      elements.push(<ul key={`ul${i}`}>{items}</ul>)
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol${i}`}>{items}</ol>)
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++; continue
    }

    // Paragraph
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
      <thead>
        <tr>{header.map((c, i) => <th key={i}>{renderInline(c)}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((row, ri) => (
          <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

function renderInline(text) {
  // Split on **bold**, *italic*, `code`, and [link](url)
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const s = m[0]
    if (s.startsWith('**')) {
      parts.push(<strong key={m.index}>{s.slice(2, -2)}</strong>)
    } else if (s.startsWith('*')) {
      parts.push(<em key={m.index}>{s.slice(1, -1)}</em>)
    } else if (s.startsWith('`')) {
      parts.push(<code key={m.index}>{s.slice(1, -1)}</code>)
    } else {
      // link
      const lm = s.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) parts.push(<a key={m.index} href={lm[2]} target="_blank" rel="noreferrer">{lm[1]}</a>)
    }
    last = m.index + s.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}
