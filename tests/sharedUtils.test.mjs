#!/usr/bin/env node
// Unit tests for the pure folder-resolution helpers in
// src/utils/omnifocusScripts/lib/sharedUtils.js. The last test, with its own
// loader, covers buildRepetitionRule's fallback before OmniFocus 4.7 (#162).
//
// sharedUtils.js is concatenated into OmniJS scripts and has no exports, so it
// cannot be imported. Instead it is read and evaluated with `new Function`,
// which mirrors the runtime's concatenation: a stubbed `Task` satisfies the
// load-time `Task.Status` dereference (see #133), and a stubbed `Folder`
// supplies the `Folder.Status` value the dropped-folder note compares against.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { addRepetitionGlobals, REPETITION_METHOD, PROJECT_STATUS } from './helpers/omnijsHarness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_UTILS = join(
  __dirname, '..', 'src', 'utils', 'omnifocusScripts', 'lib', 'sharedUtils.js'
);

const TASK_STUB = {
  Status: {
    Available: 'Available', Blocked: 'Blocked', Completed: 'Completed',
    Dropped: 'Dropped', DueSoon: 'DueSoon', Next: 'Next', Overdue: 'Overdue',
  },
};

const FOLDER_STUB = { Status: { Active: 'Active', Dropped: 'Dropped' } };

function loadSharedUtils() {
  const source = readFileSync(SHARED_UTILS, 'utf8');
  const factory = new Function(
    'Task', 'Folder',
    `${source}\nreturn { resolveFolderRef, formatAmbiguousFolderError, getFolderPath };`
  );
  return factory(TASK_STUB, FOLDER_STUB);
}

// Minimal stand-in for an OmniJS Folder: getFolderPath walks `.parent`,
// formatAmbiguousFolderError reads `.id.primaryKey`, and the dropped-folder
// note reads `.status`. Pass `id` when two fixtures would otherwise get the
// same derived ID.
function folder(name, parent = null, id = null, status = 'Active') {
  return { name, parent, id: { primaryKey: id || `${name}-${parent ? parent.name : 'root'}` }, status };
}

// A folder whose parent chain can't be read, as when an OmniJS proxy fails.
function unreadableChainFolder(name, id) {
  const f = folder(name, null, id);
  Object.defineProperty(f, 'parent', { get() { throw new Error('parent chain unreadable'); } });
  return f;
}

const { resolveFolderRef, formatAmbiguousFolderError, getFolderPath } = loadSharedUtils();

test('unique plain name resolves', () => {
  const archive = folder('Archive');
  const ref = resolveFolderRef('Archive', [folder('Clients'), archive]);
  assert.equal(ref.folder, archive);
  assert.equal(ref.ambiguous, false);
  assert.equal(ref.matches.length, 1);
});

test('plain name matching is case-insensitive', () => {
  const archive = folder('Archive');
  const ref = resolveFolderRef('aRcHiVe', [archive]);
  assert.equal(ref.folder, archive);
  assert.equal(ref.ambiguous, false);
});

test('duplicate plain name is ambiguous and resolves to nothing', () => {
  const clients = folder('Clients');
  const a = folder('Archive', clients);
  const b = folder('Archive');
  const ref = resolveFolderRef('Archive', [a, b]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.folder, null);
  assert.equal(ref.matches.length, 2);
});

test('no match is not ambiguous', () => {
  const ref = resolveFolderRef('Nope', [folder('Archive')]);
  assert.equal(ref.folder, null);
  assert.equal(ref.ambiguous, false);
  assert.equal(ref.matches.length, 0);
});

test('path syntax disambiguates a duplicated leaf name', () => {
  const clients = folder('Clients');
  const nested = folder('Archive', clients);
  const top = folder('Archive');
  const ref = resolveFolderRef('Clients > Archive', [top, nested]);
  assert.equal(ref.folder, nested);
  assert.equal(ref.ambiguous, false);
});

test('two identical full paths are ambiguous and keep distinct IDs', () => {
  const clients = folder('Clients');
  const a = folder('Archive', clients, 'a1');
  const b = folder('Archive', clients, 'a2');
  const ref = resolveFolderRef('Clients > Archive', [a, b]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.folder, null);
  assert.deepEqual(ref.matches.map((f) => f.id.primaryKey), ['a1', 'a2']);
  assert.equal(
    formatAmbiguousFolderError('Clients > Archive', ref.matches, 'folderId'),
    'Folder name "Clients > Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: a1), "Clients > Archive" (id: a2). Use the full "Parent > Child" path, or pass folderId.'
  );
});

test('error message lists every candidate by full path and folderId', () => {
  const clients = folder('Clients');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', clients), folder('Archive')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: Archive-Clients), "Archive" (id: Archive-root). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message names the calling tool\'s ID parameter', () => {
  const clients = folder('Clients');
  const matches = [folder('Archive', clients), folder('Archive')];
  for (const idParam of ['newFolderId', 'parentFolderId']) {
    assert.ok(
      formatAmbiguousFolderError('Archive', matches, idParam)
        .endsWith(`Use the full "Parent > Child" path, or pass ${idParam}.`),
      idParam
    );
  }
});

test('case-only duplicate names are ambiguous', () => {
  const ref = resolveFolderRef('ARCHIVE', [folder('Archive', null, 'x1'), folder('archive', null, 'x2')]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.matches.length, 2);
});

test('resolution table: several matches, mixed case, deeper chains', () => {
  const clients = folder('Clients');
  const work = folder('Work');
  const workClients = folder('Clients', work, 'wc');
  const top = folder('Archive', null, 'top');
  const nested = folder('Archive', clients, 'nested');
  const deep = folder('Archive', workClients, 'deep');
  const all = [clients, work, workClients, top, nested, deep];
  const cases = [
    // [input, expected folder (null = none), expected match count]
    ['Archive', null, 3],
    ['cLiEnTs > aRcHiVe', nested, 1],
    ['Work > Clients > Archive', deep, 1],
    // Full-chain rule: a path must match from the top level
    ['Clients > Archive', nested, 1],
    ['Work > Archive', null, 0],
  ];
  for (const [input, expected, count] of cases) {
    const ref = resolveFolderRef(input, all);
    assert.equal(ref.folder, expected, input);
    assert.equal(ref.matches.length, count, input);
    assert.equal(ref.ambiguous, count > 1, input);
  }
  assert.match(
    formatAmbiguousFolderError('Archive', resolveFolderRef('Archive', all).matches, 'folderId'),
    /- 3 folders match: /
  );
});

test('getFolderPath throws when the parent chain cannot be read', () => {
  assert.throws(() => getFolderPath(unreadableChainFolder('Archive', 'b1')), /parent chain unreadable/);
});

test('a path lookup throws rather than skip a candidate whose chain cannot be read', () => {
  const clients = folder('Clients');
  const nested = folder('Archive', clients, 'n1');
  assert.throws(
    () => resolveFolderRef('Clients > Archive', [clients, nested, unreadableChainFolder('Archive', 'b1')]),
    /parent chain unreadable/
  );
});

test('a plain-name lookup does not read parent chains', () => {
  const ref = resolveFolderRef('Archive', [unreadableChainFolder('Archive', 'b1'), folder('Archive', null, 'a2')]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.matches.length, 2);
});

test('error message shows a candidate with an unreadable chain by name and ID', () => {
  const message = formatAmbiguousFolderError(
    'Archive', [unreadableChainFolder('Archive', 'b1'), folder('Archive', null, 'a2')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Archive" (id: b1, full path unreadable), "Archive" (id: a2). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message marks a dropped candidate', () => {
  const clients = folder('Clients');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', clients, 'a1'), folder('Archive', null, 'a2', 'Dropped')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: a1), "Archive" (id: a2, dropped). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message marks a candidate inside a dropped folder', () => {
  const old = folder('Old', null, 'o1', 'Dropped');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', old, 'a3'), folder('Archive', null, 'a4')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Old > Archive" (id: a3, inside a dropped folder), "Archive" (id: a4). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message leaves out the dropped note when a status cannot be read', () => {
  const unreadableStatus = folder('Archive', null, 'a5');
  Object.defineProperty(unreadableStatus, 'status', { get() { throw new Error('status unreadable'); } });
  const message = formatAmbiguousFolderError('Archive', [unreadableStatus, folder('Archive', null, 'a6')], 'folderId');
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Archive" (id: a5), "Archive" (id: a6). Use the full "Parent > Child" path, or pass folderId.');
});

// The repetition-rule helper's fallback before OmniFocus 4.7 (#162). This test
// brings its own loader, because its Task stand-in has no
// RepetitionScheduleType or AnchorDateKey, as before 4.7. The 4.7 form is
// tested through the four write scripts in tests/repetitionRule.test.mjs.
test('buildRepetitionRule falls back to the Fixed method without RepetitionScheduleType', () => {
  const source = readFileSync(SHARED_UTILS, 'utf8');
  const taskBefore47 = addRepetitionGlobals({ ...TASK_STUB }, { scheduleTypes: false });
  const { buildRepetitionRule } = new Function(
    'Task', 'Folder',
    `${source}\nreturn { buildRepetitionRule };`
  )(taskBefore47, FOLDER_STUB);
  for (const repeatFrom of ['due', undefined]) {
    assert.deepEqual(
      buildRepetitionRule('FREQ=YEARLY', repeatFrom).args,
      ['FREQ=YEARLY', REPETITION_METHOD.Fixed],
      `repeatFrom: ${repeatFrom}`
    );
  }
});

// The duplicate project-name rule (#149): resolveProjectRef and
// formatAmbiguousProjectError. These tests bring their own loader, because
// the one above supplies no Project and returns only the folder helpers. It
// runs inside each test, so while the helpers are missing each test fails on
// its own and the folder tests above still run. Folders come from folder()
// above, whose statuses match FOLDER_STUB.

function loadProjectHelpers() {
  const source = readFileSync(SHARED_UTILS, 'utf8');
  return new Function(
    'Task', 'Folder', 'Project',
    `${source}\nreturn { resolveProjectRef, formatAmbiguousProjectError };`
  )(TASK_STUB, FOLDER_STUB, { Status: PROJECT_STATUS });
}

// Stand-in for an OmniJS Project: the resolver reads `.name`, and on its
// two-or-more path `.status` and `.parentFolder`; the message reads
// `.id.primaryKey`. Folders above it are walked through `.parent`.
function project(name, id, status = PROJECT_STATUS.Active, parentFolder = null) {
  return { name, id: { primaryKey: id }, status, parentFolder };
}

function throwingGetter(obj, field) {
  Object.defineProperty(obj, field, { get() { throw new Error(`${field} unreadable`); } });
  return obj;
}

const AMBIGUITY_PREFIX = (name, count) =>
  `Project name "${name}" is ambiguous - ${count} projects match, and a name only resolves when exactly one is active or on hold outside a dropped folder: `;

test('resolveProjectRef: a lone Completed match resolves (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const done = project('SMOKE-dup', 'p1', PROJECT_STATUS.Done);
  const ref = resolveProjectRef('SMOKE-dup', [project('SMOKE-other', 'p0'), done]);
  assert.equal(ref.project, done);
  assert.deepEqual(ref.matches, [done]);
  assert.equal(ref.ambiguous, false);
});

test('resolveProjectRef: a lone match with no status or parentFolder field resolves (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const bare = { name: 'SMOKE-dup', id: { primaryKey: 'p1' } };
  const ref = resolveProjectRef('SMOKE-dup', [bare]);
  assert.equal(ref.project, bare);
  assert.equal(ref.ambiguous, false);
});

test('resolveProjectRef: no match returns nothing and is not ambiguous (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  assert.deepEqual(
    resolveProjectRef('SMOKE-none', [project('SMOKE-dup', 'p1')]),
    { project: null, matches: [], ambiguous: false }
  );
});

test('resolveProjectRef: among Completed, Active, Completed the Active one is picked (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const live = project('SMOKE-dup', 'p2');
  const all = [project('SMOKE-dup', 'p1', PROJECT_STATUS.Done), live, project('SMOKE-dup', 'p3', PROJECT_STATUS.Done)];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.equal(ref.project, live);
  assert.deepEqual(ref.matches, all);
  assert.equal(ref.ambiguous, false);
});

test('resolveProjectRef: OnHold counts as live (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const onHold = project('SMOKE-dup', 'p2', PROJECT_STATUS.OnHold);
  const ref = resolveProjectRef('SMOKE-dup', [project('SMOKE-dup', 'p1', PROJECT_STATUS.Done), onHold]);
  assert.equal(ref.project, onHold);
});

test('resolveProjectRef: a Dropped project is skipped (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const live = project('SMOKE-dup', 'p2');
  const ref = resolveProjectRef('SMOKE-dup', [project('SMOKE-dup', 'p1', PROJECT_STATUS.Dropped), live]);
  assert.equal(ref.project, live);
});

test('resolveProjectRef: a project directly inside a dropped folder is skipped (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const dropped = folder('SMOKE-old', null, 'f1', 'Dropped');
  const live = project('SMOKE-dup', 'p2');
  const ref = resolveProjectRef('SMOKE-dup', [project('SMOKE-dup', 'p1', PROJECT_STATUS.Active, dropped), live]);
  assert.equal(ref.project, live);
});

test('resolveProjectRef: a project whose folder\'s parent is dropped is skipped (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const dropped = folder('SMOKE-old', null, 'f1', 'Dropped');
  const inner = folder('SMOKE-inner', dropped, 'f2');
  const live = project('SMOKE-dup', 'p2');
  const ref = resolveProjectRef('SMOKE-dup', [project('SMOKE-dup', 'p1', PROJECT_STATUS.Active, inner), live]);
  assert.equal(ref.project, live);
});

test('resolveProjectRef: no live match among several fails closed (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const none = [project('SMOKE-dup', 'p1', PROJECT_STATUS.Done), project('SMOKE-dup', 'p2', PROJECT_STATUS.Dropped)];
  assert.deepEqual(resolveProjectRef('SMOKE-dup', none), { project: null, matches: none, ambiguous: true });
  const two = [project('SMOKE-dup', 'p3'), project('SMOKE-dup', 'p4', PROJECT_STATUS.OnHold)];
  assert.deepEqual(resolveProjectRef('SMOKE-dup', two), { project: null, matches: two, ambiguous: true });
});

test('resolveProjectRef: matching ignores case (#149)', () => {
  const { resolveProjectRef } = loadProjectHelpers();
  const live = project('Smoke-Dup', 'p2');
  const all = [project('SMOKE-DUP', 'p1', PROJECT_STATUS.Done), live];
  const ref = resolveProjectRef('smoke-dup', all);
  assert.equal(ref.project, live);
  assert.deepEqual(ref.matches, all);
});

test('resolveProjectRef: an unreadable status fails closed even with a live candidate, and is marked (#149)', () => {
  const { resolveProjectRef, formatAmbiguousProjectError } = loadProjectHelpers();
  const all = [project('SMOKE-dup', 'p1'), throwingGetter(project('SMOKE-dup', 'p2'), 'status')];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.deepEqual(ref, { project: null, matches: all, ambiguous: true });
  assert.equal(
    formatAmbiguousProjectError('SMOKE-dup', ref.matches, 'projectId'),
    AMBIGUITY_PREFIX('SMOKE-dup', 2) + '"SMOKE-dup" (id: p1, Active), "SMOKE-dup" (id: p2, status unreadable). Pass projectId.'
  );
});

test('resolveProjectRef: a status outside Active, OnHold, Done and Dropped counts as unreadable (#149)', () => {
  const { resolveProjectRef, formatAmbiguousProjectError } = loadProjectHelpers();
  const all = [project('SMOKE-dup', 'p1'), project('SMOKE-dup', 'p2', 'P-Unknown')];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.project, null);
  assert.match(formatAmbiguousProjectError('SMOKE-dup', ref.matches, 'projectId'), /\(id: p2, status unreadable\)/);
});

test('resolveProjectRef: an unreadable folder chain fails closed even with a live candidate, and is marked (#149)', () => {
  const { resolveProjectRef, formatAmbiguousProjectError } = loadProjectHelpers();
  const all = [project('SMOKE-dup', 'p1'), throwingGetter(project('SMOKE-dup', 'p2'), 'parentFolder')];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.deepEqual(ref, { project: null, matches: all, ambiguous: true });
  assert.equal(
    formatAmbiguousProjectError('SMOKE-dup', ref.matches, 'projectId'),
    AMBIGUITY_PREFIX('SMOKE-dup', 2) + '"SMOKE-dup" (id: p1, Active), "SMOKE-dup" (id: p2, Active, folder path unreadable). Pass projectId.'
  );
});

test('formatAmbiguousProjectError: a chain unreadable above a dropped folder carries both notes, in order (#149)', () => {
  const { resolveProjectRef, formatAmbiguousProjectError } = loadProjectHelpers();
  const dropped = throwingGetter(folder('SMOKE-old', null, 'f1', 'Dropped'), 'parent');
  const all = [project('SMOKE-dup', 'p1'), project('SMOKE-dup', 'p2', PROJECT_STATUS.Active, dropped)];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.equal(ref.ambiguous, true);
  assert.equal(
    formatAmbiguousProjectError('SMOKE-dup', ref.matches, 'projectId'),
    AMBIGUITY_PREFIX('SMOKE-dup', 2) + '"SMOKE-dup" (id: p1, Active), "SMOKE-dup" (id: p2, Active, folder path unreadable, inside a dropped folder). Pass projectId.'
  );
});

test('formatAmbiguousProjectError: the issue\'s example message, with folder paths and statuses (#149)', () => {
  const { resolveProjectRef, formatAmbiguousProjectError } = loadProjectHelpers();
  const a = folder('SMOKE-a', null, 'fa');
  const b = folder('SMOKE-b', null, 'fb', 'Dropped');
  const all = [
    project('SMOKE-dup', 'abc123', PROJECT_STATUS.Active, a),
    project('SMOKE-dup', 'def456', PROJECT_STATUS.OnHold),
    project('SMOKE-dup', 'ghi789', PROJECT_STATUS.Active, b),
  ];
  const ref = resolveProjectRef('SMOKE-dup', all);
  assert.equal(ref.ambiguous, true);
  assert.equal(
    formatAmbiguousProjectError('SMOKE-dup', ref.matches, 'projectId'),
    'Project name "SMOKE-dup" is ambiguous - 3 projects match, and a name only resolves when exactly one is active or on hold outside a dropped folder: "SMOKE-a > SMOKE-dup" (id: abc123, Active), "SMOKE-dup" (id: def456, OnHold), "SMOKE-b > SMOKE-dup" (id: ghi789, Active, inside a dropped folder). Pass projectId.'
  );
});

test('formatAmbiguousProjectError: names Done as Completed, quotes the name as passed, and names the idParam (#149)', () => {
  const { formatAmbiguousProjectError } = loadProjectHelpers();
  const all = [project('SMOKE-Dup', 'p1', PROJECT_STATUS.Done), project('SMOKE-Dup', 'p2', PROJECT_STATUS.Dropped)];
  assert.equal(
    formatAmbiguousProjectError('smoke-dup', all, 'sourceProjectId'),
    AMBIGUITY_PREFIX('smoke-dup', 2) + '"SMOKE-Dup" (id: p1, Completed), "SMOKE-Dup" (id: p2, Dropped). Pass sourceProjectId.'
  );
});
