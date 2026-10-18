const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/utils/faculty-scope.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { facultyScopeSummary } = runtime.exports;

test('faculty scope copy describes applied filters without broadening faculty access', () => {
  const cohorts = [{ id: 8, name: '2027 CSE A', students: 24 }];
  assert.equal(facultyScopeSummary({}, cohorts), 'All assigned students');
  assert.equal(facultyScopeSummary({ cohort_id: 8, q: ' Maya ', progress: 'follow_up' }, cohorts), 'Cohort: 2027 CSE A · Search: Maya · progress: follow_up');
  assert.equal(facultyScopeSummary({ cohort_id: 99, department: 'CSE' }, cohorts), 'All assigned students · department: CSE');
});
