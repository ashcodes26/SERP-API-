export type ResumeAssetStage = 'input' | 'target' | 'review' | 'revise' | 'export';

/** Keeps the Resume Analyzer's visible guidance in step with saved work, without changing its workflow. */
export function resumeAssetStage(hasWorkspace: boolean, hasAnalysis: boolean, hasUnsavedRevision: boolean, isApproved: boolean): ResumeAssetStage {
  if (!hasWorkspace) return 'input';
  if (!hasAnalysis) return 'target';
  if (hasUnsavedRevision) return 'revise';
  if (isApproved) return 'export';
  return 'review';
}
