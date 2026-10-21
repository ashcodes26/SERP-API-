export function resumeAnalysisRequirements(target: {
  mode: 'manual' | 'listing'; title: string; description: string;
  job: { description: string } | null; consent: boolean;
}): string[] {
  const missing: string[] = [];
  if (target.mode === 'manual') {
    if (!target.title.trim()) missing.push('Enter the target job title above.');
    if (target.description.trim().length < 30) missing.push('Paste a job description with at least 30 characters above.');
  } else if (!target.job) {
    missing.push('Select a retrieved listing above, or switch to Paste job description.');
  } else if (target.job.description.trim().length < 30) {
    missing.push('This listing has too little description text. Switch to Paste job description and add the complete description.');
  }
  if (!target.consent) missing.push('Review the Google data-use notice and select the consent checkbox.');
  return missing;
}

export function validateResumeFile(name: string, size?: number): string | null {
  if (!/\.(txt|docx|pdf)$/i.test(name)) return 'Choose a text PDF, DOCX or UTF-8 TXT file.';
  if (size !== undefined && size > 1048576) return 'The file exceeds the 1 MiB limit.';
  if (size === 0) return 'The file is empty.';
  return null;
}
export function validTaskDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function replaceSuggestedText(text: string, original: string, proposed: string): string {
  const start = text.indexOf(original);
  if (!original || !proposed || original === proposed || start < 0 || text.indexOf(original, start + 1) !== -1) {
    throw new Error('This passage has changed or appears more than once in your editor. Review it manually or reanalyze; your other edits are preserved.');
  }
  const next = text.slice(0, start) + proposed + text.slice(start + original.length);
  if (next.length > 20000) throw new Error('This edit exceeds the resume text limit. Shorten the editor text before replacing.');
  return next;
}

export function suggestionIsApplied(text: string, original: string, proposed: string): boolean {
  const start = text.indexOf(proposed);
  return !!proposed && start >= 0 && !text.replace(proposed, '').includes(original);
}

export function highlightedRevision(text: string, passages: string[]): { text: string; highlight: boolean }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const passage of new Set(passages)) {
    if (!passage) continue;
    const start = text.indexOf(passage);
    // Ambiguous duplicates are not labelled as an applied edit.
    if (start >= 0 && text.indexOf(passage, start + 1) < 0) ranges.push({ start, end: start + passage.length });
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const parts: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (cursor < range.start) parts.push({ text: text.slice(cursor, range.start), highlight: false });
    parts.push({ text: text.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }
  if (cursor < text.length || !parts.length) parts.push({ text: text.slice(cursor), highlight: false });
  return parts;
}
