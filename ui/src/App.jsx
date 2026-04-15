import { useState, useEffect } from 'react'
import Applications from './components/Applications'
import Pipeline from './components/Pipeline'
import Reports from './components/Reports'
import Commands from './components/Commands'
import Setup from './components/Setup'
import './App.css'

const TABS = [
  { id: 'applications', label: 'Applications' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'reports', label: 'Reports' },
  { id: 'setup', label: 'Setup' },
  { id: 'commands', label: 'Commands' },
]

export default function App() {
  const [tab, setTab] = useState('applications')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/data')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <span className="logo">career-ops</span>
          {data && (
            <div className="stats">
              <span className="stat"><strong>{data.stats.total}</strong> tracked</span>
              <span className="stat apply"><strong>{data.stats.applied}</strong> applied</span>
              <span className="stat interview"><strong>{data.stats.interview}</strong> interviews</span>
              <span className="stat pending"><strong>{data.pipeline?.pending?.length ?? 0}</strong> pending</span>
            </div>
          )}
        </div>
        <button className="refresh-btn" onClick={fetchData} disabled={loading}>
          ↺ Refresh
        </button>
      </header>

      <nav>
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {loading && <div className="center-msg">Loading…</div>}
        {error && <div className="center-msg error">Error: {error}</div>}
        {!loading && !error && data && (
          <>
            {tab === 'applications' && <Applications data={data} onRefresh={fetchData} />}
            {tab === 'pipeline' && <Pipeline data={data} onRefresh={fetchData} />}
            {tab === 'reports' && <Reports data={data} />}
            {tab === 'setup' && <Setup />}
            {tab === 'commands' && <Commands />}
          </>
        )}
      </main>
    </div>
  )
}
