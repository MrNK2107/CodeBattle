import { Fragment, type ReactNode } from 'react';

/**
 * Tiny Markdown subset for problem statements: paragraphs, `- ` lists,
 * `code`, **bold** and *italic*. Text is rendered as React children (no HTML
 * injection), which is all the question bank uses.
 */
export function Markdown({ text, className }: { text: string; className?: string }): JSX.Element {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every(l => /^\s*[-*] /.test(l))) {
          return (
            <ul key={i} className="my-3 list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*] /, ''))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every(l => /^\s*\d+\. /.test(l))) {
          return (
            <ol key={i} className="my-3 list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*\d+\. /, ''))}</li>
              ))}
            </ol>
          );
        }
        if (block.startsWith('```')) {
          return (
            <pre key={i} className="my-3 overflow-x-auto rounded-md bg-well p-3 font-mono text-[13px]">
              {block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')}
            </pre>
          );
        }
        return (
          <p key={i} className="my-3 first:mt-0 last:mb-0">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    if (match.index! > last) out.push(text.slice(last, match.index));
    if (token.startsWith('`')) {
      out.push(
        <code key={key++} className="rounded bg-well px-1.5 py-0.5 font-mono text-[0.86em] text-text">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={key++} className="font-semibold text-text">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index! + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
