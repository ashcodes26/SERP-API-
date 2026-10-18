const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative) {
  const file = path.resolve(__dirname, relative);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const runtime = new Module(file, module); runtime._compile(output, file);
  return runtime.exports;
}

const { createLatestRequestGate } = load('../src/utils/latest-request.ts');
const { sessionRestoreAction } = load('../src/utils/session-restore.ts');
const { canOpenJourneyStep, journeyStepState } = load('../src/utils/journey-stage.ts');

test('overlapping Journey requests are last-request-wins, so an old failure cannot overwrite a newer success', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const retry = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(retry), true);
});

test('retry becomes the current request and can clear the prior connection error', () => {
  const gate = createLatestRequestGate();
  const failedRequest = gate.begin();
  const retry = gate.begin();
  assert.equal(gate.isCurrent(failedRequest), false);
  assert.equal(gate.isCurrent(retry), true);
});

test('session restoration clears only expired or invalid authenticated sessions', () => {
  assert.equal(sessionRestoreAction(401), 'clear_session');
  assert.equal(sessionRestoreAction(403), 'show_error');
  assert.equal(sessionRestoreAction(500), 'show_error');
  assert.equal(sessionRestoreAction(undefined), 'show_error');
});

test('Journey progression keeps completed steps revisitable without unlocking prerequisites early', () => {
  assert.equal(canOpenJourneyStep('profile', false, false), false);
  assert.equal(canOpenJourneyStep('analysis', true, false), false);
  assert.equal(canOpenJourneyStep('analysis', true, true), true);
  assert.equal(canOpenJourneyStep('roadmap', true, true), true);
  assert.equal(journeyStepState('profile', 'analysis', true, true), 'complete');
  assert.equal(journeyStepState('analysis', 'roadmap', true, true), 'complete');
  assert.equal(journeyStepState('roadmap', 'roadmap', true, true), 'current');
  assert.equal(journeyStepState('roadmap', 'profile', true, false), 'locked');
});
