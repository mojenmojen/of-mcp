# TypeScript Compiler OOM Troubleshooting

If `tsc` crashes with an out-of-memory error or hangs indefinitely when building this project, try these solutions in order.

## Known cause: TypeScript 5.8.3 and 5.9.3 (#136)

TypeScript 5.8.3 and 5.9.3 run out of memory type-checking this project against MCP SDK 1.25.2. 5.9.3 did so even with a 12 GB heap. `package.json` caps TypeScript at `~5.6.3` for that reason. Check your version first:

```bash
npx tsc --version
```

If it says anything newer than 5.6, your `node_modules` was installed before the cap. Reinstall from the lockfile with `npm ci`. The rest of this page covers other causes.

## If tsc Hangs Completely (Even Diagnostics)

If tsc hangs and you can't even get diagnostics output, skip it entirely and use esbuild. This one-liner does a complete build:

```bash
npm run build:fast
```

This takes ~1 second and produces a working build. If it fails with `esbuild: command not found`, your `node_modules` was installed before esbuild became a devDependency. Run `npm ci` first.

### Reset node_modules

A corrupted `node_modules` or mismatched lockfile can cause tsc to hang indefinitely during module resolution:

```bash
npm ci
```

`npm ci` replaces `node_modules` itself, and only after checking the lockfile, so a run that stops early leaves your old install in place. Keep `package-lock.json`: without it, every dependency floats to the newest version `package.json` allows. If `npm ci` stops because `package.json` and `package-lock.json` are out of sync, run `npm install` instead. It brings the lockfile in line with `package.json` and keeps the locked versions that still fit.

Then try `npm run build` again.

## Diagnosing Where tsc Hangs

If tsc runs but is slow, these commands help identify the bottleneck:

```bash
# Show detailed timing for each phase
npx tsc --extendedDiagnostics

# Show which files are being processed
npx tsc --listFiles

# Trace type resolution (very verbose)
npx tsc --traceResolution > trace.log 2>&1 &
sleep 30 && kill $!
head -1000 trace.log
```

If `--extendedDiagnostics` shows it's stuck on "Check time", the issue is complex type inference (likely from Zod or MCP SDK types).

## Quick Fixes

### 1. Increase Node.js Memory Limit

Check `npx tsc --version` first. On 5.8.3 or 5.9.3 the fix is `npm ci` (see Known cause above), not more memory: 5.9.3 still ran out of memory with a 12 GB heap.

Otherwise, the default heap size may be too small. Run the build with more memory:

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run build
```

Or for even more memory (if available):

```bash
NODE_OPTIONS="--max-old-space-size=16384" npm run build
```

### 2. Enable Incremental Compilation

Add `"incremental": true` to `tsconfig.json` under `compilerOptions`:

```json
{
  "compilerOptions": {
    "incremental": true,
    ...
  }
}
```

This caches type information between builds, reducing memory usage on subsequent runs.

### 3. Close Other Applications

Free up RAM by closing browsers, IDEs, and other memory-intensive applications before building.

## Skip Type Checking (Fastest Workaround)

If you just need a working build and don't care about type errors, use esbuild (see below). It completely bypasses TypeScript's type checker and just transpiles the code.

## Alternative Build Methods

### Using esbuild (Fastest, Lowest Memory) - RECOMMENDED

esbuild is already a devDependency, and `npm run build:fast` runs these steps for you. To run them by hand:

```bash
# Build the server
npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.js --format=esm --external:@modelcontextprotocol/sdk --external:zod

# Then copy the script files
mkdir -p dist/utils/omnifocusScripts/lib
cp src/utils/omnifocusScripts/*.js dist/utils/omnifocusScripts/
cp src/utils/omnifocusScripts/lib/*.js dist/utils/omnifocusScripts/lib/
```

Note: esbuild skips type checking entirely. Run `npx tsc --noEmit` separately if you need type validation.

### Using SWC

```bash
npm install -D @swc/cli @swc/core

npx swc src -d dist --strip-leading-paths
```

## Diagnostic Commands

Run these to understand your environment:

```bash
# Check available memory
free -h          # Linux
vm_stat          # macOS

# Check Node.js version
node -v

# Check current heap limit
node -e "console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024 + ' MB')"

# Monitor memory during build
NODE_OPTIONS="--max-old-space-size=8192" npm run build &
top -p $!        # Linux
top -pid $!      # macOS
```

## System Requirements

This project requires:
- Node.js >= 18.0.0
- Recommended: 8GB+ RAM for comfortable builds
- Minimum: 4GB RAM (use memory limit increase)

## Make Sure the Capped Version Is Installed

The project already caps TypeScript at `~5.6.3`, the only version verified against the lockfile's dependencies. If `npx tsc --version` shows anything else, reinstall from the lockfile, which installs 5.6.3:

```bash
npm ci
npx tsc --version  # Verify it's 5.6.3
npm run build
```

## Why This Happens

The `@modelcontextprotocol/sdk` and `zod` dependencies have complex TypeScript generic types. During type checking, TypeScript must resolve these types, which can consume significant memory. The codebase itself is small (~8K lines), but the type inference for these libraries is intensive.

On this project the known trigger is TypeScript 5.8.3 or 5.9.3 together with the types in MCP SDK 1.25.2 (#136). TypeScript 5.6.3 checks the same code in seconds. So does 5.8.3 against the older SDK 1.17.0, which means a later SDK bump could bring the failure back on 5.6.3 too. `tests/toolchain.test.mjs` pins the lockfile's SDK to 1.25.x for that reason, so `npm test` fails until the new SDK has been type-checked.
