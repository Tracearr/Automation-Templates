#!/usr/bin/env node
/**
 * One Discussion per template, in the "Templates" category, created or updated
 * from index.json and matched by a marker in the body rather than by title, so
 * renaming a template does not orphan its thread.
 *
 * The discussion number goes back into index.json: giscus maps a docs page to a
 * thread by number, and that number is the only link between the two.
 *
 * Needs GITHUB_TOKEN with `discussions: write` and GITHUB_REPOSITORY.
 * GitHub's API cannot create a discussion category, so the "Templates" one is
 * made by hand once, in the Announcements format.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const categoryName = process.env.DISCUSSION_CATEGORY ?? 'Templates';
const docsBase = process.env.DOCS_BASE_URL ?? 'https://docs.tracearr.com/templates';

if (!token) throw new Error('GITHUB_TOKEN is not set');
if (!repository) throw new Error('GITHUB_REPOSITORY is not set');
const [owner, name] = repository.split('/');

async function graphql(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'tracearr-automation-templates',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (payload.errors) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  return payload.data;
}

const marker = (slug) => `<!-- tracearr-template: ${slug} -->`;

function bodyFor(entry) {
  return [
    marker(entry.slug),
    entry.sentence,
    '',
    `Group: ${entry.group} · Records: ${entry.kind === 'policy' ? 'a violation' : 'just an alert'}`,
    `Needs Tracearr ${entry.minServerVersion} or newer · fingerprint \`${entry.fingerprint}\``,
    '',
    'Share code. Paste it into Tracearr under Automations → Import:',
    '',
    '```',
    entry.code,
    '```',
    '',
    `Details: ${docsBase}/${entry.slug}`,
    '',
    'This thread is created and updated by CI. Reactions and replies here show up on the docs page.',
  ].join('\n');
}

const head = await graphql(
  `query ($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      discussionCategories(first: 25) { nodes { id name } }
    }
  }`,
  { owner, name }
);

const repositoryId = head.repository.id;
const category = head.repository.discussionCategories.nodes.find((node) => node.name === categoryName);
if (!category) {
  throw new Error(
    `No "${categoryName}" discussion category in ${repository}. Create it by hand (Announcements format), then rerun.`
  );
}

const existing = new Map();
let cursor = null;
for (;;) {
  const page = await graphql(
    `query ($owner: String!, $name: String!, $categoryId: ID!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        discussions(first: 100, after: $cursor, categoryId: $categoryId) {
          nodes { id number title body }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { owner, name, categoryId: category.id, cursor }
  );
  const { nodes, pageInfo } = page.repository.discussions;
  for (const node of nodes) {
    const found = /<!-- tracearr-template: ([a-z0-9-]+) -->/.exec(node.body ?? '');
    if (found) existing.set(found[1], node);
  }
  if (!pageInfo.hasNextPage) break;
  cursor = pageInfo.endCursor;
}

const index = JSON.parse(readFileSync('index.json', 'utf8'));
let created = 0;
let updated = 0;
let unchanged = 0;

for (const entry of index) {
  const body = bodyFor(entry);
  const found = existing.get(entry.slug);

  if (!found) {
    const result = await graphql(
      `mutation ($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
          discussion { number }
        }
      }`,
      { repositoryId, categoryId: category.id, title: entry.name, body }
    );
    entry.discussionNumber = result.createDiscussion.discussion.number;
    created += 1;
    continue;
  }

  entry.discussionNumber = found.number;
  if (found.body === body && found.title === entry.name) {
    unchanged += 1;
    continue;
  }
  await graphql(
    `mutation ($discussionId: ID!, $title: String!, $body: String!) {
      updateDiscussion(input: { discussionId: $discussionId, title: $title, body: $body }) {
        discussion { number }
      }
    }`,
    { discussionId: found.id, title: entry.name, body }
  );
  updated += 1;
}

writeFileSync('index.json', `${JSON.stringify(index, null, 2)}\n`);
console.log(`discussions: ${created} created, ${updated} updated, ${unchanged} unchanged`);
