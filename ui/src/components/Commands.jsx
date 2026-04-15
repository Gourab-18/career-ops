const COMMANDS = [
  {
    group: 'Evaluation',
    items: [
      { cmd: '/career-ops {URL or JD text}', desc: 'Full auto-pipeline: evaluate + report + PDF + tracker update' },
      { cmd: '/career-ops oferta', desc: 'Evaluate a single offer (A-F scoring, no auto-PDF)' },
      { cmd: '/career-ops ofertas', desc: 'Compare and rank multiple offers side-by-side' },
      { cmd: '/career-ops pipeline', desc: 'Process all pending URLs from data/pipeline.md in batch' },
    ]
  },
  {
    group: 'Discovery',
    items: [
      { cmd: '/career-ops scan', desc: 'Scan portals (Greenhouse, Ashby, Lever, YC) for new India/remote roles' },
      { cmd: '/career-ops deep', desc: 'Deep company research: funding, culture, tech stack, red flags' },
    ]
  },
  {
    group: 'Application',
    items: [
      { cmd: '/career-ops pdf', desc: 'Generate ATS-optimized PDF CV tailored to the role' },
      { cmd: '/career-ops apply', desc: 'Live application assistant: fill form fields and draft answers' },
      { cmd: '/career-ops contacto', desc: 'LinkedIn power move: find hiring manager + draft outreach message' },
    ]
  },
  {
    group: 'Tracking & Analysis',
    items: [
      { cmd: '/career-ops tracker', desc: 'Application status overview and funnel stats' },
      { cmd: '/career-ops patterns', desc: 'Analyze rejection patterns and sharpen targeting' },
      { cmd: '/career-ops followup', desc: 'Follow-up cadence: flag overdue, generate follow-up drafts' },
    ]
  },
  {
    group: 'Career Development',
    items: [
      { cmd: '/career-ops training', desc: 'Evaluate a course or cert against your North Star goals' },
      { cmd: '/career-ops project', desc: 'Evaluate a portfolio project idea for career ROI' },
    ]
  },
]

const TIPS = [
  'Add job URLs to data/pipeline.md → run /career-ops pipeline to batch evaluate all of them.',
  'Paste a raw JD directly into Claude Code — /career-ops will auto-detect it and run the full pipeline.',
  'After PDF generation, CV files land in output/ (gitignored).',
  'Reports are stored in reports/ as {###}-{company}-{date}.md.',
  'Scores ≥ 3.5/5 → worth applying. Below 3.0 → SKIP unless you have a strong specific reason.',
  'Run /career-ops scan periodically to keep the pipeline full with fresh India/remote roles.',
]

export default function Commands() {
  return (
    <div className="tab-content commands-page">
      <h2>Quick Commands Reference</h2>
      <p className="subtitle">Run these slash commands in Claude Code (CLI or VSCode extension).</p>

      {COMMANDS.map(group => (
        <section key={group.group} className="cmd-group">
          <h3>{group.group}</h3>
          <table className="cmd-table">
            <tbody>
              {group.items.map(item => (
                <tr key={item.cmd}>
                  <td className="cmd-cell"><code>{item.cmd}</code></td>
                  <td className="desc-cell">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="tips-section">
        <h3>Tips</h3>
        <ul>
          {TIPS.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      </section>

      <section className="workflow-section">
        <h3>Typical Weekly Workflow</h3>
        <ol>
          <li>Run <code>/career-ops scan</code> to find new offers → URLs land in <code>data/pipeline.md</code></li>
          <li>Run <code>/career-ops pipeline</code> to evaluate all pending URLs in batch</li>
          <li>Review Applications tab — sort by Score to find top candidates</li>
          <li>For ≥ 3.5/5 roles: run <code>/career-ops pdf</code> to generate tailored CV</li>
          <li>Run <code>/career-ops contacto</code> to find hiring manager and draft outreach</li>
          <li>After applying: update status in <code>data/applications.md</code></li>
          <li>Run <code>/career-ops followup</code> weekly to track overdue follow-ups</li>
        </ol>
      </section>
    </div>
  )
}
