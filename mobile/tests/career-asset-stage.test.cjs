const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/utils/career-asset-stage.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { resumeAssetStage } = runtime.exports;

test('Resume workflow guidance follows saved state without changing the underlying actions', () => {
  assert.equal(resumeAssetStage(false, false, false, false), 'input');
  assert.equal(resumeAssetStage(true, false, false, false), 'target');
  assert.equal(resumeAssetStage(true, true, false, false), 'review');
  assert.equal(resumeAssetStage(true, true, true, false), 'revise');
  assert.equal(resumeAssetStage(true, true, false, true), 'export');
});
