const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module'); const ts = require('typescript');
const file = path.resolve(__dirname, '../src/utils/document-review.ts');
const runtime = new Module(file, module); runtime._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { decisionKey, decisionRequest, documentValue } = runtime.exports;
test('review mutations carry both versions, explicit conflict confirmation and original retry key', () => {
  const p = { version: 3 }; const i = { version: 2, field_path: 'skills' }; const key = decisionKey();
  assert.match(key, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const request = decisionRequest(p, i, 'edit', key, 'Python', true);
  assert.deepEqual(request, { proposal_version: 3, item_version: 2, decision: 'edit', idempotency_key: key, confirm_conflict: true, edited_value: { name: 'Python' } });
  assert.deepEqual(decisionRequest(p, i, 'edit', key, 'Python', true), request);
  assert.equal(decisionRequest(p, i, 'reject', key, '', false).edited_value, undefined);
  assert.equal(documentValue(null), 'Not recorded');
});
