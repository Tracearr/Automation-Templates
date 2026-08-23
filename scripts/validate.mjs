#!/usr/bin/env node
/**
 * What CI runs on every pull request. Exits 1 with one line per problem.
 */

import { readTemplates, shareCodeOf, sentenceOf } from './lib.mjs';

const { templates, errors } = readTemplates();

for (const { file, envelope } of templates) {
  const code = shareCodeOf(envelope);
  console.log(`ok  ${file}`);
  console.log(`    ${sentenceOf(envelope)}`);
  console.log(`    ${envelope.group} · ${envelope.kind} · ${code.length} char code · ${envelope.fingerprint.slice(0, 12)}…`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`\n${templates.length} templates, all valid.`);
