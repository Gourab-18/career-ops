import { useState } from 'react'

export default function Pipeline({ data, onRefresh }) {
  const { pending = [], processed = [], errors = [] } = data.pipeline || {}
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)

  function addUrls() {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(u => /^https?:\/\//.test(u))
    if (!urls.length) {
      setMsg({ type: 'err', text: 'No valid URLs found. Each line should start with https://' })
      return
    }
    setAdding(true)
    fetch('/api/pipeline/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
      .then(r => r.json())
      .then(d => {
        setAdding(false)
        if (d.ok) {
          setMsg({ type: 'ok', text: `Added ${d.added} URL${d.added > 1 ? 's' : ''} to pipeline.md → run /career-ops pipeline in Claude Code to evaluate` })
          setUrlInput('')
          onRefresh()
        } else {
          setMsg({ type: 'err', text: d.error })
        }
        setTimeout(() => setMsg(null), 6000)
      })
      .catch(e => { setAdding(false); setMsg({ type: 'err', text: e.message }) })
  }

  return (
    <div className="tab-content">
      <h2>Pipeline</h2>
      <p className="subtitle">Add job URLs here and evaluate them through Claude Code.</p>

      {/* ── Add URLs box ── */}
      <div className="pipeline-add-box">
        <div className="pipeline-add-header">
          <span className="pipeline-add-title">Add Job URLs to Inbox</span>
          <span className="pipeline-add-hint">One URL per line</span>
        </div>
        <textarea
          className="pipeline-url-input"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder={
            'https://jobs.ashbyhq.com/company/job-id\nhttps://job-boards.greenhouse.io/company/jobs/123\nhttps://jobs.lever.co/company/job-id'
          }
          rows={4}
        />
        <div className="pipeline-add-footer">
          {msg && <span className={`save-msg ${msg.type}`}>{msg.text}</span>}
          <button className="save-btn" onClick={addUrls} disabled={adding || !urlInput.trim()}>
            {adding ? 'Adding…' : '+ Add to Inbox'}
          </button>
        </div>

        <div className="pipeline-run-hint">
          <div className="hint-step">
            <span className="hint-num">1</span>
            <span>Paste job URLs above → <strong>Add to Inbox</strong></span>
          </div>
          <span className="hint-arrow">→</span>
          <div className="hint-step">
            <span className="hint-num">2</span>
            <span>Open Claude Code and run:</span>
            <CopyCode text="/career-ops pipeline" />
          </div>
          <span className="hint-arrow">→</span>
          <div className="hint-step">
            <span className="hint-num">3</span>
            <span>Evaluated reports appear in the <strong>Reports</strong> tab</span>
          </div>
        </div>
      </div>

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3>Pending <span className="count">{pending.length}</span></h3>
          <ul className="pipeline-list">
            {pending.map((item, i) => (
              <li key={i} className="pipeline-item pending">
                <span className="badge pending-badge">PENDING</span>
                {item.url
                  ? <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                  : <span>{item.raw}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Errors ── */}
      {errors.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h3>Errors <span className="count error">{errors.length}</span></h3>
          <ul className="pipeline-list">
            {errors.map((item, i) => (
              <li key={i} className="pipeline-item error">
                <span className="badge error-badge">ERROR</span>
                <span>{item.raw}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Processed ── */}
      <section style={{ marginTop: 20 }}>
        <h3>Processed <span className="count">{processed.length}</span></h3>
        {processed.length === 0
          ? <p className="empty-msg">Nothing evaluated yet. Add URLs above and run the pipeline.</p>
          : (
            <ul className="pipeline-list">
              {processed.map((item, i) => (
                <li key={i} className="pipeline-item processed">
                  <span className="badge done-badge">DONE</span>
                  <span className="pipeline-num">#{item.num}</span>
                  {item.url
                    ? <a href={item.url} target="_blank" rel="noreferrer">{item.company || item.url}</a>
                    : <span>{item.company || item.raw}</span>}
                  {item.role && <span className="pipeline-role"> — {item.role}</span>}
                  {item.score && <span className="pipeline-score">{item.score}</span>}
                  {item.action && (
                    <span className={`pipeline-action ${item.action.trim() === 'SKIP' ? 'skip' : 'ok'}`}>
                      {item.action}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}

function CopyCode({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <span className="copy-code" onClick={copy} title="Click to copy">
      <code>{text}</code>
      <span className="copy-icon">{copied ? '✓' : '⎘'}</span>
    </span>
  )
}
