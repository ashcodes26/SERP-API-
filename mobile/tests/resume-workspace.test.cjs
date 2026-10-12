const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/utils/resume-workspace.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { validateResumeFile, validTaskDate, replaceSuggestedText, suggestionIsApplied, highlightedRevision } = runtime.exports;
test('resume upload accepts implemented formats and rejects empty and oversized files before sending', () => {
  assert.equal(validateResumeFile('Resume.DOCX', 1048576), null);
  assert.equal(validateResumeFile('resume.txt'), null);
  assert.equal(validateResumeFile('resume.pdf', 100), null);
  assert.match(validateResumeFile('resume.png', 100), /Choose/);
  assert.match(validateResumeFile('resume.txt', 1048577), /1 MiB/);
  assert.match(validateResumeFile('resume.txt', 0), /empty/);
});
test('task due date permits omission and leap dates, rejects rollover and locale formats', () => {
  assert.ok(validTaskDate('')); assert.ok(validTaskDate('2028-02-29'));
  assert.equal(validTaskDate('2026-02-29'), false);
  assert.equal(validTaskDate('2026-04-31'), false);
  assert.equal(validTaskDate('10/10/2026'), false);
});
test('Replace changes the current editor immediately and preserves previous replacements and manual text', () => {
  const original = 'Summary: I use Python.\nProjects: I built a tool.\nMy manual note.';
  let editor = replaceSuggestedText(original, 'I use Python.', 'Python experience.');
  assert.match(editor, /Python experience/);
  assert.ok(suggestionIsApplied(editor, 'I use Python.', 'Python experience.'));
  editor = replaceSuggestedText(editor, 'I built a tool.', 'Built a tool.');
  assert.equal(editor, 'Summary: Python experience.\nProjects: Built a tool.\nMy manual note.');
  editor = replaceSuggestedText(editor, 'Python experience.', 'I use Python.');
  assert.equal(editor, 'Summary: I use Python.\nProjects: Built a tool.\nMy manual note.');
  assert.equal(suggestionIsApplied(editor, 'I use Python.', 'Python experience.'), false);
  assert.equal(original, 'Summary: I use Python.\nProjects: I built a tool.\nMy manual note.');
});
test('Replace refuses missing or ambiguous passages and detects already-applied formatting changes', () => {
  assert.throws(() => replaceSuggestedText('A changed passage.', 'Original text.', 'Improved text.'), /passage has changed/);
  assert.throws(() => replaceSuggestedText('Same. Same.', 'Same.', 'Improved.'), /more than once/);
  assert.throws(() => replaceSuggestedText('Same.', 'Same.', 'Same.'), /passage has changed/);
  assert.ok(suggestionIsApplied('- Built a tool.', 'Built a tool.', '- Built a tool.'));
  assert.equal(suggestionIsApplied('Built a tool.', 'Built a tool.', '- Built a tool.'), false);
});
test('revision highlights preserve exact text, merge overlaps and disappear after undo', () => {
  const text = 'Intro\nBuilt a Python tool.\nCreated SQL reports.\nEnd';
  const parts = highlightedRevision(text, ['Built a Python tool.', 'Python tool.', 'Created SQL reports.']);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.highlight).map(part => part.text), ['Built a Python tool.', 'Created SQL reports.']);
  assert.equal(highlightedRevision(text, ['Missing passage.']).some(part => part.highlight), false);
  const reverted = text.replace('Built a Python tool.', 'Worked on a Python tool.');
  assert.equal(highlightedRevision(reverted, ['Built a Python tool.']).some(part => part.highlight), false);
  assert.equal(highlightedRevision('Same. Same.', ['Same.']).some(part => part.highlight), false);
});
