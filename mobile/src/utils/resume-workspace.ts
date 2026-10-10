export function validateResumeFile(name: string, size?: number): string | null {
  if (!/\.(txt|docx)$/i.test(name)) return 'Choose a UTF-8 TXT or DOCX file. PDF and images are unsupported.';
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
