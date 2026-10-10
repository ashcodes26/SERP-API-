const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Execute the production pure helpers with the project's existing TypeScript compiler.
const file = path.resolve(__dirname, '../src/utils/market-data.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtime = new Module(file, module); runtime._compile(compiled, file);
const { radarData, buildMarketFilters, demandCsv } = runtime.exports;

test('radar excludes unknowns, preserves recorded zero and caps axes without mutating inputs', () => {
  const skills = [{ name: 'unknown', competency_percentage: null, demand_percentage: 100 },
    { name: 'zero', competency_percentage: 0, demand_percentage: 100 },
    ...Array.from({ length: 8 }, (_, i) => ({ name: `skill ${i}`, competency_percentage: 80, demand_percentage: 90 - i }))];
  const snapshot = JSON.stringify(skills);
  const out = radarData(skills);
  assert.equal(out.length, 6); assert.equal(out[0].student, 0);
  assert.ok(!out.some(row => row.subject === 'unknown')); assert.equal(JSON.stringify(skills), snapshot);
  assert.deepEqual(radarData([{ name: 'unknown', competency_percentage: null, demand_percentage: 100 }]), []);
});
test('filter edits produce real query fields with inclusive UTC dates and reject invalid ranges', () => {
  assert.deepEqual(buildMarketFilters(' Python ', ' Chennai ', '2026-10-01', '2026-10-10'), { role: 'Python', location: 'Chennai', collected_after: '2026-10-01T00:00:00Z', collected_before: '2026-10-10T23:59:59.999Z' });
  assert.deepEqual(buildMarketFilters('', '', '', ''), { role: '', location: '' });
  assert.throws(() => buildMarketFilters('', '', '2026-02-30', ''));
  assert.throws(() => buildMarketFilters('', '', '2026-10-11', '2026-10-10'));
});
test('CSV uses sample counts and filters, escapes strings, and prevents formula injection', () => {
  const out = demandCsv({ sample_size: 4, filters: { role: '=unsafe', location: 'City,"Test"' }, last_collected_at: '2026-10-10T00:00:00Z', skills: [{ name: 'SQL', distinct_job_count: 1, demand_percentage: 25 }] });
  assert.ok(out.includes('"SQL","1","25","4"')); assert.ok(out.includes('"\'=unsafe"')); assert.ok(out.includes('"City,""Test"""'));
});
