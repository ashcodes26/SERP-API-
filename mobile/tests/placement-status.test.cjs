const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/utils/placement-status.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { eligibilityPresentation, displayPlacementStatus } = runtime.exports;

test('placement eligibility labels keep eligible, ineligible, review, and unknown states distinct', () => {
  assert.equal(eligibilityPresentation(null).label, 'Eligibility pending');
  assert.equal(eligibilityPresentation({ status: 'eligible', reasons: [] }).label, 'Eligible');
  assert.equal(eligibilityPresentation({ status: 'not_eligible', reasons: ['CGPA'] }).label, 'Not eligible');
  assert.equal(eligibilityPresentation({ status: 'needs_review', reasons: [] }).label, 'Eligibility needs review');
  assert.equal(displayPlacementStatus('in_progress'), 'in progress');
});
