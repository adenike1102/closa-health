// Writes api/data/questions_schema.json from the frontend question list,
// so the server validates answers against exactly the codes the UI offers.
// Run from the repo root:  node scripts/export_schema.mjs
import { writeFileSync } from 'node:fs';
import { QUESTIONS } from '../frontend/src/lib/questions.js';

export function buildSchema() {
  const schema = {};
  for (const q of QUESTIONS) {
    if (q.type === 'upload') continue; // the CSV step has no answer of its own
    schema[q.id] = { type: q.type, codes: q.options.map((o) => o.code) };
  }
  return schema;
}

if (process.argv[1] && process.argv[1].endsWith('export_schema.mjs')) {
  writeFileSync(new URL('../api/data/questions_schema.json', import.meta.url), JSON.stringify(buildSchema(), null, 2) + '\n');
  console.log('Wrote api/data/questions_schema.json');
}
