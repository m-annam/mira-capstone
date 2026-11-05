// Prints JS check-engine results for every fixture output as JSON (consumed by tests/test_checks.py).
const fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(__dirname, '..', 'n8n', 'src', 'eval_checks.js'), 'utf8').replace('function runChecks', 'global.runChecks = function'));
const gt = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'ground_truth.json'), 'utf8'));
const ids = JSON.parse(process.argv[2]);
const out = {};
for (const kind of ['good', 'bad']) {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${kind}_outputs.json`), 'utf8'));
  for (const t of gt.tests) if (fx[t.test_id]) {
    const r = runChecks(fx[t.test_id].output, fx[t.test_id].route, t.input, t.checks, ids);
    out[`${kind}:${t.test_id}`] = { pass: r.pass, checks: r.results.map(c => [c.id, c.pass]), unknown: r.unknown_ids };
  }
}
console.log(JSON.stringify(out));
