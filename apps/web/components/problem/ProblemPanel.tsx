import { Markdown } from '@/components/Markdown';
import { DIFFICULTY_LABEL, DIFFICULTY_TEXT } from '@/lib/format';
import type { PublicQuestion } from '@/lib/questions';

export function ProblemPanel({ question, footer }: { question: PublicQuestion; footer?: React.ReactNode }): JSX.Element {
  return (
    <article className="panel flex h-full flex-col overflow-hidden">
      <div className="space-y-2 border-b border-line px-5 py-4">
        <h1 className="text-xl font-semibold">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`font-semibold ${DIFFICULTY_TEXT[question.difficulty]}`}>{DIFFICULTY_LABEL[question.difficulty]}</span>
          {question.tags.map(tag => (
            <span key={tag} className="rounded bg-raised px-2 py-0.5 text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed text-text/90">
        <Markdown text={question.description} />

        <section aria-label="Examples" className="space-y-3">
          {question.examples.map((ex, i) => (
            <div key={i} className="space-y-1.5">
              <h2 className="font-sans text-sm font-semibold text-text">Example {i + 1}</h2>
              <div className="space-y-1 rounded-md border-l-2 border-line bg-well px-3 py-2 font-mono text-[13px]">
                <p className="break-words">
                  <span className="text-faint">Input </span>
                  {ex.input}
                </p>
                <p className="break-words">
                  <span className="text-faint">Output </span>
                  {ex.expected}
                </p>
                {ex.explanation ? <p className="font-sans text-sm text-muted">{ex.explanation}</p> : null}
              </div>
            </div>
          ))}
        </section>

        <section aria-label="Constraints" className="space-y-1.5">
          <h2 className="font-sans text-sm font-semibold text-text">Constraints</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {question.constraints.map(c => (
              <li key={c}>
                <Markdown text={c} className="inline" />
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-muted">
          Aim for {question.optimalBigO} time and {question.optimalSpace} extra space; hidden tests include large inputs.
        </p>
        {footer}
      </div>
    </article>
  );
}
