import ReactMarkdown from 'react-markdown';
import { Doc } from './Icons';

function severityCounts(md: string) {
  return {
    crit: (md.match(/critical/gi) || []).length,
    high: (md.match(/\bhigh\b/gi) || []).length,
    med: (md.match(/\b(medium|med)\b/gi) || []).length,
    low: (md.match(/\blow\b/gi) || []).length,
  };
}

export default function Report({ markdown }: { markdown: string }) {
  const c = severityCounts(markdown);
  const tags: Array<[keyof typeof c, string]> = [
    ['crit', 'critical'],
    ['high', 'high'],
    ['med', 'medium'],
    ['low', 'low'],
  ];

  return (
    <section className="panel report-wrap fade-in">
      <div className="panel-head report-head">
        <h3>
          <Doc size={15} /> Confirmed Findings
        </h3>
        <div className="sev-strip">
          {tags
            .filter(([k]) => c[k] > 0)
            .map(([k, label]) => (
              <span className={`sev-tag ${k}`} key={k}>
                <i /> {c[k]} {label}
              </span>
            ))}
        </div>
      </div>
      <div className="report-body">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </section>
  );
}
