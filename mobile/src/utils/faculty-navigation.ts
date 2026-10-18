export const facultySections = ['overview', 'students', 'analytics', 'placement', 'reviews-training', 'reports'] as const;
export type FacultySection = typeof facultySections[number];

export function isFacultySection(value: string | undefined): value is FacultySection {
  return !!value && facultySections.includes(value as FacultySection);
}

/** An explicit valid section takes priority; a detail link otherwise belongs to Students. */
export function resolveFacultySection(section: string | undefined, studentId?: string): FacultySection {
  if (isFacultySection(section)) return section;
  return studentId ? 'students' : 'overview';
}
