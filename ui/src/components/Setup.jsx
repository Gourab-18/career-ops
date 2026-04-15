import { useState, useRef, useEffect } from 'react'

export default function Setup() {
  const [tab, setTab] = useState('cv')

  return (
    <div className="tab-content">
      <h2>Setup</h2>
      <p className="subtitle">Manage your CV and job preferences — all changes are saved directly to the project files.</p>

      <div className="sub-tabs">
        <button className={tab === 'cv' ? 'active' : ''} onClick={() => setTab('cv')}>Resume / CV</button>
        <button className={tab === 'prefs' ? 'active' : ''} onClick={() => setTab('prefs')}>Job Preferences</button>
      </div>

      {tab === 'cv' && <CVEditor />}
      {tab === 'prefs' && <PreferencesForm />}
    </div>
  )
}

// ─── CV Editor ───────────────────────────────────────────────────────────────

function CVEditor() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    fetch('/api/cv')
      .then(r => r.text())
      .then(t => { setContent(t); setLoading(false) })
      .catch(() => { setContent(''); setLoading(false) })
  }, [])

  function save() {
    setSaving(true)
    fetch('/api/cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        setMsg(d.ok ? { type: 'ok', text: 'Saved to cv.md' } : { type: 'err', text: d.error })
        setTimeout(() => setMsg(null), 3000)
      })
      .catch(e => { setSaving(false); setMsg({ type: 'err', text: e.message }) })
  }

  function uploadFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'md' || ext === 'txt') {
      // Read directly and paste into editor
      const reader = new FileReader()
      reader.onload = ev => { setContent(ev.target.result); setMsg({ type: 'ok', text: `Loaded ${file.name} — edit below then Save` }); setTimeout(() => setMsg(null), 4000) }
      reader.readAsText(file)
      return
    }

    // For PDF/DOCX: upload to server for storage, show instructions
    setUploading(true)
    const formData = new FormData()
    formData.append('resume', file)
    fetch('/api/resume', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        setUploading(false)
        if (d.ok) {
          setMsg({ type: 'ok', text: `Uploaded ${file.name} (${(d.size / 1024).toFixed(1)} KB). Now paste your resume text into the editor below to save it as cv.md.` })
          setTimeout(() => setMsg(null), 8000)
        } else {
          setMsg({ type: 'err', text: d.error })
        }
      })
      .catch(e => { setUploading(false); setMsg({ type: 'err', text: e.message }) })
  }

  if (loading) return <div className="center-msg">Loading cv.md…</div>

  return (
    <div className="cv-editor">
      <div className="cv-toolbar">
        <div className="upload-area">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.md,.txt,.docx"
            style={{ display: 'none' }}
            onChange={uploadFile}
          />
          <button className="upload-btn" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '↑ Upload Resume'}
          </button>
          <span className="upload-hint">PDF, .md, .txt, .docx — or paste text directly below</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span className={`save-msg ${msg.type}`}>{msg.text}</span>}
          <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save cv.md'}</button>
        </div>
      </div>

      <div className="editor-info">
        <strong>cv.md</strong> is the canonical CV used for all evaluations and PDF generation.
        Edit here or upload a file to populate it.
      </div>

      <textarea
        className="cv-textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Paste or type your CV in markdown format…"
        spellCheck={false}
      />
    </div>
  )
}

// ─── Preferences Form ─────────────────────────────────────────────────────────

const DEFAULTS = {
  full_name: '', email: '', phone: '', location: '', linkedin: '', github: '',
  target_range: '', minimum: '', location_flexibility: '', headline: '',
  exit_story: '', timeline: '',
  primary_roles: [],
  preferred_companies: [],
  hard_no: [],
  energizing: [],
  draining: [],
}

function PreferencesForm() {
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const p = d.profile || {}
        setForm({
          full_name: p.full_name || '',
          email: p.email || '',
          phone: p.phone || '',
          location: p.location || '',
          linkedin: p.linkedin || '',
          github: p.github || '',
          target_range: p.target_range || '',
          minimum: p.minimum || '',
          location_flexibility: p.location_flexibility || '',
          headline: p.headline || '',
          exit_story: p.exit_story || '',
          timeline: p.timeline || '',
          primary_roles: p.primary_roles || [],
          preferred_companies: p.preferred_companies || [],
          hard_no: p.hard_no || [],
          energizing: p.energizing || [],
          draining: p.draining || [],
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setList(k, v) {
    // v is a newline-separated string → array
    set(k, v.split('\n').map(s => s.trim()).filter(Boolean))
  }

  function save() {
    setSaving(true)
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        setMsg(d.ok ? { type: 'ok', text: 'Saved to config/profile.yml' } : { type: 'err', text: d.error })
        setTimeout(() => setMsg(null), 3000)
      })
      .catch(e => { setSaving(false); setMsg({ type: 'err', text: e.message }) })
  }

  if (loading) return <div className="center-msg">Loading profile…</div>

  return (
    <div className="pref-form">
      <div className="pref-save-bar">
        {msg && <span className={`save-msg ${msg.type}`}>{msg.text}</span>}
        <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Preferences'}</button>
      </div>

      <div className="pref-sections">

        <section className="pref-section">
          <h3>Personal Info</h3>
          <div className="pref-grid">
            <Field label="Full Name" value={form.full_name} onChange={v => set('full_name', v)} />
            <Field label="Email" value={form.email} onChange={v => set('email', v)} />
            <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} />
            <Field label="Location (current)" value={form.location} onChange={v => set('location', v)} />
            <Field label="LinkedIn URL" value={form.linkedin} onChange={v => set('linkedin', v)} />
            <Field label="GitHub URL" value={form.github} onChange={v => set('github', v)} />
          </div>
        </section>

        <section className="pref-section">
          <h3>Target Roles</h3>
          <p className="field-hint">One per line (e.g. ML Engineer, Backend SWE, AI Engineer)</p>
          <textarea
            className="list-textarea"
            value={form.primary_roles.join('\n')}
            onChange={e => setList('primary_roles', e.target.value)}
            rows={4}
            placeholder="ML Engineer&#10;Backend Engineer&#10;AI/Data Engineer"
          />
        </section>

        <section className="pref-section">
          <h3>Compensation</h3>
          <div className="pref-grid">
            <Field label="Target Range (e.g. ₹30L-50L)" value={form.target_range} onChange={v => set('target_range', v)} />
            <Field label="Minimum (hard floor)" value={form.minimum} onChange={v => set('minimum', v)} />
            <Field label="Location Flexibility" value={form.location_flexibility} onChange={v => set('location_flexibility', v)} placeholder="Open to remote, hybrid, or on-site in Bangalore" />
          </div>
        </section>

        <section className="pref-section">
          <h3>Your Narrative</h3>
          <Field label="Headline (1 sentence)" value={form.headline} onChange={v => set('headline', v)} placeholder="e.g. Backend engineer moving into ML — Oracle + production ML pipelines" />
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Exit Story / Motivation</label>
            <textarea
              className="list-textarea"
              value={form.exit_story}
              onChange={e => set('exit_story', e.target.value)}
              rows={3}
              placeholder="Why are you looking? What's your transition story?"
            />
          </div>
          <Field label="Job Search Timeline" value={form.timeline} onChange={v => set('timeline', v)} placeholder="e.g. Actively looking, targeting exit in 2-3 months" />
        </section>

        <section className="pref-section">
          <h3>Company Preferences</h3>
          <div className="pref-two-col">
            <div>
              <label className="field-label">Preferred company types (one per line)</label>
              <textarea
                className="list-textarea"
                value={form.preferred_companies.join('\n')}
                onChange={e => setList('preferred_companies', e.target.value)}
                rows={4}
                placeholder="Product-based MNCs&#10;US-funded startups&#10;AI-core companies"
              />
            </div>
            <div>
              <label className="field-label">Hard NO — auto-SKIP these (one per line)</label>
              <textarea
                className="list-textarea"
                value={form.hard_no.join('\n')}
                onChange={e => setList('hard_no', e.target.value)}
                rows={4}
                placeholder="IT service companies (TCS, Infosys…)&#10;Java-only roles&#10;Pure frontend"
              />
            </div>
          </div>
        </section>

        <section className="pref-section">
          <h3>Work Style</h3>
          <div className="pref-two-col">
            <div>
              <label className="field-label">What energizes you (one per line)</label>
              <textarea
                className="list-textarea"
                value={form.energizing.join('\n')}
                onChange={e => setList('energizing', e.target.value)}
                rows={4}
                placeholder="ML systems design&#10;Async work culture&#10;Deep engineering problems"
              />
            </div>
            <div>
              <label className="field-label">What drains you / deal-breakers (one per line)</label>
              <textarea
                className="list-textarea"
                value={form.draining.join('\n')}
                onChange={e => setList('draining', e.target.value)}
                rows={4}
                placeholder="Heavy frontend / pure UI&#10;Meeting-heavy culture&#10;No-code/low-code roles"
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
      />
    </div>
  )
}
