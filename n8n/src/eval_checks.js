// ============================================================================
// Mira | Check engine (JavaScript).  Same rules as eval/checks.py — keep in sync.
// Used inside the n8n "Evaluate Output" node and by tests/check_parity.js.
//
// A check is { id, type, required (default true), ... }:
//   regex            { pattern, flags? }   output must match
//   not_regex        { pattern, flags? }   output must NOT match
//   route            { value: "plan" | ["clarify","status"] }
//   ids_grounded     {}                    every T### / R## in the output exists in the data
//                                          (IDs the user typed in the request are exempt)
//   forbid_ids       { ids: [...] }        none of these IDs may appear
//   percents_allowed { allowed: ["15","10"] } every N% in the output is in the list
//   min_distinct     { pattern, min }      at least `min` distinct matches of pattern
// ============================================================================
function runChecks(output, route, chatInput, checks, dataIds) {
  const text = String(output || '');
  const userText = String(chatInput || '');
  const known = new Set([...(dataIds.tasks || []), ...(dataIds.risks || [])]);
  const userIds = new Set(userText.match(/\b(T\d{3}|R\d{2})\b/g) || []);
  const mentioned = [...new Set(text.match(/\b(T\d{3}|R\d{2})\b/g) || [])];
  const unknownIds = mentioned.filter(id => !known.has(id) && !userIds.has(id));
  const rx = (p, f) => new RegExp(p, (f || 'i').replace(/[^gimsuy]/g, ''));

  const results = (checks || []).map(c => {
    let pass = false, detail = '';
    switch (c.type) {
      case 'regex': pass = rx(c.pattern, c.flags).test(text); break;
      case 'not_regex': { const m = text.match(rx(c.pattern, c.flags)); pass = !m; if (m) detail = `found: ${m[0].slice(0, 60)}`; break; }
      case 'route': { const allowed = [].concat(c.value); pass = allowed.includes(route); detail = `route=${route}`; break; }
      case 'ids_grounded': pass = unknownIds.length === 0; if (!pass) detail = `unknown: ${unknownIds.join(',')}`; break;
      case 'forbid_ids': { const hit = (c.ids || []).filter(id => new RegExp(`\\b${id}\\b`).test(text)); pass = hit.length === 0; if (hit.length) detail = `found: ${hit.join(',')}`; break; }
      case 'percents_allowed': {
        const found = [...new Set((text.match(/\b\d+(?:\.\d+)?\s?%/g) || []).map(s => s.replace(/\s|%/g, '')))];
        const bad = found.filter(n => !(c.allowed || []).includes(n));
        pass = bad.length === 0; if (bad.length) detail = `unexpected: ${bad.map(b => b + '%').join(',')}`; break;
      }
      case 'min_distinct': {
        const found = new Set(text.match(rx(c.pattern, (c.flags || '') + 'g')) || []);
        pass = found.size >= (c.min || 1); detail = `distinct=${found.size}`; break;
      }
      default: detail = `unknown check type ${c.type}`;
    }
    return { id: c.id, type: c.type, required: c.required !== false, pass, detail, label: c.label || '' };
  });

  const req = results.filter(r => r.required);
  return {
    results,
    pass: req.length ? req.every(r => r.pass) : null,
    required_passed: req.filter(r => r.pass).length,
    required_total: req.length,
    check_rate: results.length ? results.filter(r => r.pass).length / results.length : null,
    mentioned_ids: mentioned,
    unknown_ids: unknownIds,
    id_grounding: mentioned.length ? (mentioned.length - unknownIds.length) / mentioned.length : 1,
  };
}
