const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync('src/utils/role-routing.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} }; vm.runInNewContext(output, context);
const { permittedPath, homePath } = context.exports;
test('student and faculty dashboards are distinct', () => {
  assert.equal(homePath('student'), '/'); assert.equal(homePath('admin'), '/admin');
});
test('permitted intended pages survive login and refresh, including detail params', () => {
  assert.equal(permittedPath('admin', '/admin?student=7'), true);
  assert.equal(permittedPath('student', '/resume'), true);
  assert.equal(permittedPath('student', '/placement'), true);
});
test('unauthorized screens redirect to the role dashboard', () => {
  assert.equal(permittedPath('student', '/admin'), false);
  assert.equal(permittedPath('student', '/admin-import'), false);
  assert.equal(permittedPath('admin', '/resume'), false);
  assert.equal(permittedPath('admin', '/'), false);
  assert.equal(permittedPath('student', 'https://example.org'), false);
});
