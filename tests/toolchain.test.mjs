#!/usr/bin/env node
// Toolchain pin tests (issue #136).
//
// TypeScript 5.8.3 and 5.9.3 run out of memory type-checking this project
// against MCP SDK 1.25.2, so the devDependency is capped at 5.6.x. The lockfile
// once drifted to 5.9.3 unnoticed. Raise the cap only after `npx tsc --noEmit`
// finishes on the new version, and update these tests in the same change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = readJson('../package.json');
const lock = readJson('../package-lock.json');

const TS_RANGE = '~5.6.3';
const TS_LOCKED = /^5\.6\./;
const RAISE_CAP =
  'TypeScript is capped because 5.8.3 and 5.9.3 run out of memory against MCP SDK 1.25.2 (#136). ' +
  'Raise the cap only after `npx tsc --noEmit` finishes on the new version, ' +
  'then update TS_RANGE and TS_LOCKED in tests/toolchain.test.mjs.';

test('package.json caps typescript below 5.7 (#136)', () => {
  assert.equal(pkg.devDependencies.typescript, TS_RANGE, RAISE_CAP);
});

test('lockfile records the same typescript range as package.json', () => {
  assert.equal(
    lock.packages[''].devDependencies.typescript,
    pkg.devDependencies.typescript,
    'package-lock.json is out of step with package.json. Regenerate it with `npm install`, not by hand.',
  );
});

test('lockfile resolves typescript to 5.6.x (#136)', () => {
  assert.match(lock.packages['node_modules/typescript'].version, TS_LOCKED, RAISE_CAP);
});
