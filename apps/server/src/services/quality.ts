export interface QualityIssue {
  type: 'error' | 'warning';
  message: string;
  location?: string;
}

export interface QualityScore {
  score: number;
  issues: QualityIssue[];
}

export function computeQualityScore(language: string, issues: QualityIssue[]): QualityScore {
  const penalties = issues.reduce((acc, issue) => acc + (issue.type === 'error' ? 10 : 3), 0);
  const score = Math.max(0, 100 - penalties);
  return { score, issues };
}
