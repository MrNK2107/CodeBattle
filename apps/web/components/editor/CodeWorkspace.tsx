"use client";

import Editor, { loader, type BeforeMount, type OnMount } from '@monaco-editor/react';
import { LANGUAGES, LANGUAGE_LABELS, type Language, type RunResult, type TypingEvent } from '@codebattle/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { RunResults } from './RunResults';

export interface Telemetry {
  onTyping: (events: TypingEvent[], pastedChars: number) => void;
  onSnapshot: (code: string, language: Language) => void;
}

interface CodeWorkspaceProps {
  starterCode: Record<Language, string>;
  /** localStorage namespace for drafts, e.g. `battle:<id>` */
  draftKey: string;
  readOnly?: boolean;
  busy: 'run' | 'submit' | null;
  runDisabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  onRun: (code: string, language: Language) => void;
  onSubmit: (code: string, language: Language) => void;
  result: RunResult | null;
  /** shown above the run results (e.g. the battle verdict) */
  banner?: ReactNode;
  telemetry?: Telemetry;
  editorHeight?: string;
}

// served from our own origin (copied by scripts/copy-monaco.mjs), not a CDN
loader.config({ paths: { vs: '/monaco/vs' } });

const LANG_KEY = 'cb:language';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode / quota: drafts just won't persist
  }
}

const defineTheme: BeforeMount = monaco => {
  monaco.editor.defineTheme('codebattle', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6B6F8A', fontStyle: 'italic' },
      { token: 'keyword', foreground: '38D6F5' },
      { token: 'string', foreground: '6BD99A' },
      { token: 'number', foreground: 'FF8F2B' },
    ],
    colors: {
      'editor.background': '#07080C',
      'editor.lineHighlightBackground': '#1A1D28',
      'editorLineNumber.foreground': '#3A3F52',
      'editorLineNumber.activeForeground': '#959AB0',
      'editorCursor.foreground': '#38D6F5',
      'editor.selectionBackground': '#38D6F544',
      'editorIndentGuide.background1': '#1A1D28',
    },
  });
};

export function CodeWorkspace({
  starterCode,
  draftKey,
  readOnly,
  busy,
  runDisabled,
  submitDisabled,
  submitLabel = 'Submit',
  onRun,
  onSubmit,
  result,
  banner,
  telemetry,
  editorHeight = 'min(58vh, 560px)',
}: CodeWorkspaceProps): JSX.Element {
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState('');
  const [loaded, setLoaded] = useState(false);
  const typing = useRef<{ events: TypingEvent[]; pasted: number }>({ events: [], pasted: 0 });
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const latest = useRef({ code, language });
  latest.current = { code, language };
  const runRef = useRef<() => void>(() => undefined);

  const draftFor = useCallback((lang: Language) => `cb:draft:${draftKey}:${lang}`, [draftKey]);

  // restore language + draft once mounted (localStorage is client-only)
  useEffect(() => {
    const savedLang = readStorage(LANG_KEY);
    const lang = savedLang && (LANGUAGES as readonly string[]).includes(savedLang) ? (savedLang as Language) : 'python';
    setLanguage(lang);
    setCode(readStorage(draftFor(lang)) ?? starterCode[lang]);
    setLoaded(true);
  }, [draftFor, starterCode]);

  const changeLanguage = (lang: Language) => {
    if (lang === language) return;
    writeStorage(draftFor(language), code);
    writeStorage(LANG_KEY, lang);
    setLanguage(lang);
    setCode(readStorage(draftFor(lang)) ?? starterCode[lang]);
  };

  const updateCode = (value: string) => {
    setCode(value);
    writeStorage(draftFor(language), value);
  };

  const reset = () => {
    if (!window.confirm(`Replace your ${LANGUAGE_LABELS[language]} code with the starter code?`)) return;
    updateCode(starterCode[language]);
  };

  // batch telemetry: keys every 2 s, code snapshots every 5 s
  useEffect(() => {
    if (!telemetry) return;
    const typingTimer = setInterval(() => {
      const batch = typing.current;
      if (!batch.events.length && !batch.pasted) return;
      typing.current = { events: [], pasted: 0 };
      telemetryRef.current?.onTyping(batch.events, batch.pasted);
    }, 2000);
    let lastSnapshot = '';
    const snapshotTimer = setInterval(() => {
      const { code: current, language: lang } = latest.current;
      if (current === lastSnapshot) return;
      lastSnapshot = current;
      telemetryRef.current?.onSnapshot(current, lang);
    }, 5000);
    return () => {
      clearInterval(typingTimer);
      clearInterval(snapshotTimer);
    };
  }, [telemetry]);

  const onMount: OnMount = (editor, monaco) => {
    editor.onKeyDown(e => {
      const key = e.browserEvent.key;
      const k = key === 'Backspace' || key === 'Delete' ? 'backspace' : key.length === 1 || key === 'Enter' || key === 'Tab' ? 'char' : 'other';
      if (e.browserEvent.ctrlKey || e.browserEvent.metaKey) return;
      typing.current.events.push({ t: Date.now(), k });
    });
    editor.onDidPaste(e => {
      const pasted = editor.getModel()?.getValueInRange(e.range).length ?? 0;
      typing.current.pasted += pasted;
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const runNow = () => onRun(latest.current.code, latest.current.language);
  runRef.current = () => {
    if (!readOnly && !runDisabled && !busy) runNow();
  };

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 22,
      fontFamily: 'var(--font-mono), ui-monospace, monospace',
      fontLigatures: true,
      scrollBeyondLastLine: false,
      readOnly,
      tabSize: language === 'javascript' ? 2 : 4,
      padding: { top: 12 },
      automaticLayout: true,
      renderLineHighlight: 'line' as const,
    }),
    [readOnly, language]
  );

  return (
    <section className="panel flex flex-col overflow-hidden" aria-label="Code editor">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="segmented" role="radiogroup" aria-label="Language">
            {LANGUAGES.map(lang => (
              <button key={lang} type="button" role="radio" aria-checked={language === lang} disabled={readOnly} onClick={() => changeLanguage(lang)}>
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          {!readOnly ? (
            <button type="button" onClick={reset} className="rounded px-2 py-1 text-xs text-faint hover:text-text">
              Reset
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-quiet py-1.5" onClick={runNow} disabled={readOnly || runDisabled || busy !== null} title="Run the examples (Ctrl+Enter)">
            {busy === 'run' ? 'Running…' : 'Run examples'}
          </button>
          <button type="button" className="btn-submit py-1.5" onClick={() => onSubmit(latest.current.code, latest.current.language)} disabled={readOnly || submitDisabled || busy !== null}>
            {busy === 'submit' ? 'Judging…' : submitLabel}
          </button>
        </div>
      </div>

      <div className="bg-well" style={{ height: editorHeight }}>
        {loaded ? (
          <Editor
            height="100%"
            theme="codebattle"
            language={language}
            value={code}
            options={options}
            beforeMount={defineTheme}
            onMount={onMount}
            onChange={value => updateCode(value ?? '')}
            loading={<p className="p-4 text-sm text-muted">Loading editor…</p>}
          />
        ) : null}
      </div>

      <div className="max-h-[42vh] min-h-[9rem] overflow-y-auto border-t border-line">
        {banner}
        <RunResults result={result} emptyHint="Run the examples to see your output here. Ctrl+Enter runs them from the editor." />
      </div>
    </section>
  );
}
