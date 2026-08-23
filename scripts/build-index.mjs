#!/usr/bin/env node
/**
 * Writes index.json, which is the only file the docs gallery reads.
 *
 * Every field is derived here: the share code from the envelope, the sentence
 * and the consequence lines from the definition, `builtin` from builtins.json,
 * `verified` from verified.json. Nothing a contributor writes outside the
 * envelope reaches the page.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { effectsOf, readTemplates, sentenceOf, shareCodeOf } from './lib.mjs';

const readJson = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;

const { templates, errors } = readTemplates();
if (errors.length > 0) {
  console.error('Refusing to build an index from templates that do not validate:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const builtins = readJson('builtins.json', {});
const verified = new Set(readJson('verified.json', []));
// Discussion numbers are written back by the discussions workflow; keep whatever
// is already there so a rebuild does not orphan a thread.
const previous = new Map(readJson('index.json', []).map((entry) => [entry.slug, entry]));

const index = templates.map(({ envelope }) => {
  const entry = {
    slug: envelope.slug,
    name: envelope.name,
    description: envelope.description,
    group: envelope.group,
    kind: envelope.kind,
    minServerVersion: envelope.minServerVersion,
    inputs: envelope.inputs,
    sentence: sentenceOf(envelope),
    effects: effectsOf(envelope),
    code: shareCodeOf(envelope),
    fingerprint: envelope.fingerprint,
    builtin: builtins[envelope.slug] === envelope.fingerprint,
    verified: verified.has(envelope.slug),
  };
  if (envelope.author) entry.author = envelope.author;
  const discussionNumber = previous.get(envelope.slug)?.discussionNumber;
  if (typeof discussionNumber === 'number') entry.discussionNumber = discussionNumber;
  return entry;
});

index.sort((left, right) => (left.slug < right.slug ? -1 : 1));
writeFileSync('index.json', `${JSON.stringify(index, null, 2)}\n`);

const builtinCount = index.filter((entry) => entry.builtin).length;
const verifiedCount = index.filter((entry) => entry.verified).length;
console.log(
  `index.json: ${index.length} templates (${builtinCount} built-in, ${verifiedCount} verified)`
);
