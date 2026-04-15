export default function Pipeline({ data }) {
  const { pending = [], processed = [], errors = [] } = data.pipeline || {}

  return (
    <div className="tab-content">
      <h2>Pipeline Inbox</h2>
      <p className="subtitle">
        Add URLs to <code>data/pipeline.md</code> then run{' '}
        <code>/career-ops pipeline</code> in Claude Code to evaluate.
      </p>

      {pending.length > 0 && (
        <section>
          <h3>Pending <span className="count">{pending.length}</span></h3>
          <ul className="pipeline-list">
            {pending.map((item, i) => (
              <li key={i} className="pipeline-item pending">
                <span className="badge pending-badge">PENDING</span>
                {item.url
                  ? <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                  : <span>{item.raw}</span>
                }
              </li>
            ))}
          </ul>
        </section>
      )}

      {errors.length > 0 && (
        <section>
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

      <section>
        <h3>Processed <span className="count">{processed.length}</span></h3>
        {processed.length === 0
          ? <p className="empty-msg">No processed entries yet.</p>
          : (
            <ul className="pipeline-list">
              {processed.map((item, i) => (
                <li key={i} className="pipeline-item processed">
                  <span className="badge done-badge">DONE</span>
                  <span className="pipeline-num">#{item.num}</span>
                  {item.url
                    ? <a href={item.url} target="_blank" rel="noreferrer">{item.company || item.url}</a>
                    : <span>{item.company || item.raw}</span>
                  }
                  {item.role && <span className="pipeline-role"> — {item.role}</span>}
                  {item.score && <span className="pipeline-score">{item.score}</span>}
                  {item.action && (
                    <span className={`pipeline-action ${item.action === 'SKIP' ? 'skip' : 'ok'}`}>
                      {item.action}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </section>

      {pending.length === 0 && errors.length === 0 && processed.length === 0 && (
        <div className="empty-box">
          <p>Inbox is empty.</p>
          <p>Add job URLs (one per line) to the <code>## Pending</code> section in <code>data/pipeline.md</code>, then run <code>/career-ops pipeline</code>.</p>
        </div>
      )}
    </div>
  )
}
