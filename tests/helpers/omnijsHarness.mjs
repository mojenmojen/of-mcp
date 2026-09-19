// Shared harness for script-level tests of the OmniJS scripts in
// src/utils/omnifocusScripts/. It lives outside tests/*.test.mjs, so the test
// runner doesn't pick it up as a test file.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'utils', 'omnifocusScripts');

// Mirrors the parameter injection and sharedUtils splice in
// executeOmniFocusScript() (src/utils/scriptExecution.ts). Keep the injection
// text in step with it.
function assemble(scriptFile, args) {
  const script = readFileSync(join(SCRIPTS, scriptFile), 'utf8');
  const sharedUtils = readFileSync(join(SCRIPTS, 'lib', 'sharedUtils.js'), 'utf8');
  const injection = `
    // Injected parameters
    const injectedArgs = ${JSON.stringify(args)};
    const perspectiveName = injectedArgs.perspectiveName || null;
    const perspectiveId = injectedArgs.perspectiveId || null;
    const hideCompleted = injectedArgs.hideCompleted !== undefined ? injectedArgs.hideCompleted : true;
    const limit = injectedArgs.limit || 100;
    const includeBuiltIn = injectedArgs.includeBuiltIn !== undefined ? injectedArgs.includeBuiltIn : false;
    const includeSidebar = injectedArgs.includeSidebar !== undefined ? injectedArgs.includeSidebar : true;
    const format = injectedArgs.format || "detailed";
    `;
  return script.replace(
    '(() => {',
    `(() => {\n${injection}\n  // === Shared utilities ===\n${sharedUtils}\n  // === End shared utilities ===\n`
  );
}

// Runs an assembled script in its own node:vm context, which gives it its own
// global scope as OmniJS does, and parses the JSON string it returns.
export function runScript(scriptFile, args, globals) {
  return JSON.parse(vm.runInNewContext(assemble(scriptFile, args), { ...globals }));
}

// Stand-ins for the OmniJS status enums. The values only need to be distinct.
export const TASK_STATUS = {
  Available: 'Available', Blocked: 'Blocked', Completed: 'Completed',
  Dropped: 'Dropped', DueSoon: 'DueSoon', Next: 'Next', Overdue: 'Overdue',
};
export const FOLDER_STATUS = { Active: 'F-Active', Dropped: 'F-Dropped' };
export const PROJECT_STATUS = { Active: 'P-Active', Done: 'P-Done', Dropped: 'P-Dropped', OnHold: 'P-OnHold' };

// Stand-in for an OmniJS Folder: getFolderPath walks `.parent`, lookups and
// the ambiguity error read `.id.primaryKey`, and the dropped-folder note reads
// `.status`.
export function folder(name, parent, id, status = FOLDER_STATUS.Active) {
  return { name, parent, id: { primaryKey: id }, status };
}
