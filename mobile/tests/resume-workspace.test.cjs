const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/utils/resume-workspace.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { validateResumeFile, validTaskDate } = runtime.exports;
test('resume upload accepts implemented formats and rejects empty and oversized files before sending', () => {
  assert.equal(validateResumeFile('Resume.DOCX', 1048576), null);
  assert.equal(validateResumeFile('resume.txt'), null);
  assert.match(validateResumeFile('resume.pdf', 100), /unsupported/);
  assert.match(validateResumeFile('resume.txt', 1048577), /1 MiB/);
  assert.match(validateResumeFile('resume.txt', 0), /empty/);
});
test('task due date permits omission and leap dates, rejects rollover and locale formats', () => {
  assert.ok(validTaskDate('')); assert.ok(validTaskDate('2028-02-29'));
  assert.equal(validTaskDate('2026-02-29'), false);
  assert.equal(validTaskDate('2026-04-31'), false);
  assert.equal(validTaskDate('10/10/2026'), false);
});
