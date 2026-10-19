import type { DocumentDecisionIn, DocumentItemOut, DocumentProposalOut, DocumentValue } from '../types/contracts';

export function documentValue(value: DocumentValue | null) { return value ? ('name' in value ? value.name : value.value) : 'Not recorded'; }
export function decisionRequest(proposal: DocumentProposalOut, item: DocumentItemOut, decision: DocumentDecisionIn['decision'], key: string, edited: string, confirm: boolean): DocumentDecisionIn {
  return { proposal_version: proposal.version, item_version: item.version, decision, idempotency_key: key, confirm_conflict: confirm,
    ...(decision === 'edit' ? { edited_value: item.field_path === 'skills' ? { name: edited } : { value: edited } } : {}) };
}
// Uniqueness for request replay, never an authentication token or secret.
export function decisionKey() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : ((n & 3) | 8)).toString(16); }); }
