import { TestCaseResult } from '@codebattle/shared';
import { create } from 'zustand';

export type EditorLanguage = 'python' | 'javascript' | 'java';

type Status = 'idle' | 'running' | 'submitted';

type BattleState = {
  language: EditorLanguage;
  code: string;
  results: TestCaseResult[];
  status: Status;
  setLanguage: (language: EditorLanguage) => void;
  setCode: (code: string) => void;
  setResults: (results: TestCaseResult[]) => void;
  setStatus: (status: Status) => void;
  reset: () => void;
};

const starterCode: Record<EditorLanguage, string> = {
  python: '# Write your solution\n',
  javascript: '// Write your solution\n',
  java: 'class Solution {\n    // Write your solution\n}\n'
};

export const useBattleState = create<BattleState>(set => ({
  language: 'javascript',
  code: starterCode.javascript,
  results: [],
  status: 'idle',
  setLanguage: language => set(() => ({ language, code: starterCode[language], results: [] })),
  setCode: code => set(() => ({ code })),
  setResults: results => set(() => ({ results })),
  setStatus: status => set(() => ({ status })),
  reset: () => set(() => ({ language: 'javascript', code: starterCode.javascript, results: [], status: 'idle' }))
}));
