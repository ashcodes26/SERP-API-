import type { EligibilityOut } from '@/types/contracts';

export function eligibilityPresentation(decision: EligibilityOut | null) {
  if (!decision) return { label: 'Eligibility pending', detail: 'No eligibility decision is available for this drive yet.', tone: 'pending' as const };
  if (decision.status === 'eligible') return { label: 'Eligible', detail: 'You meet the recorded drive rules. Confirm the employer requirements before applying.', tone: 'eligible' as const };
  if (decision.status === 'not_eligible') return { label: 'Not eligible', detail: 'The recorded drive rules are not currently met. Read the reasons below or contact your coordinator.', tone: 'ineligible' as const };
  return { label: 'Eligibility needs review', detail: 'The recorded information needs faculty or coordinator review before eligibility is confirmed.', tone: 'pending' as const };
}

export function displayPlacementStatus(value: string) {
  return value.replaceAll('_', ' ');
}
