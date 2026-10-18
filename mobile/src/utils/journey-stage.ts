export type JourneyStage = 'input' | 'profile' | 'analysis' | 'roadmap';
export type JourneyStep = Exclude<JourneyStage, 'input'>;

export const journeySteps: { id: JourneyStep; label: string; description: string }[] = [
  { id: 'profile', label: 'Profile', description: 'Confirm your evidence and target role.' },
  { id: 'analysis', label: 'Role Alignment', description: 'Review evidence coverage and priority gaps.' },
  { id: 'roadmap', label: 'Learning Roadmap', description: 'Follow your plan and optionally generate AI guidance.' },
];

export function canOpenJourneyStep(step: JourneyStep, hasProfile: boolean, hasAnalysis: boolean) {
  if (step === 'profile') return hasProfile;
  return hasAnalysis;
}

export function journeyStepState(step: JourneyStep, stage: JourneyStage, hasProfile: boolean, hasAnalysis: boolean): 'current' | 'complete' | 'available' | 'locked' {
  const effectiveStage: JourneyStep = stage === 'input' ? 'profile' : stage;
  if (step === effectiveStage) return 'current';
  if (!canOpenJourneyStep(step, hasProfile, hasAnalysis)) return 'locked';
  if (step === 'profile' && hasAnalysis) return 'complete';
  if (step === 'analysis' && effectiveStage === 'roadmap') return 'complete';
  return 'available';
}
