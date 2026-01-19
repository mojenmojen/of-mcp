# TypeScript Compiler OOM Troubleshooting

If `tsc` crashes with an out-of-memory error or hangs indefinitely when building this project, try these solutions in order.

## If tsc Hangs Completely (Even Diagnostics)

If tsc hangs and you can't even get diagnostics output, skip it entirely and use esbuild. This one-liner does a complete build:

```bash
npm install -D esbuild && npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.js --format=esm --external:@modelcontextprotocol/sdk --external:zod && mkdir -p dist/utils/omnifocusScripts/lib && cp src/utils/omnifocusScripts/*.js dist/utils/omnifocusScripts/ && cp src/utils/omnifocusScripts/lib/*.js dist/utils/omnifocusScripts/lib/ && chmod 755 dist/server.js
```

This takes ~1 second and produces a working build.

### Reset node_modules

A corrupted `node_modules` or mismatched lockfile can cause tsc to hang indefinitely during module resolution:

```bash
rm -rf node_modules package-lock.json && npm install
```

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

The default heap size may be too small. Run the build with more memory:

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

Install and run esbuild as an alternative to tsc:

```bash
npm install -D esbuild

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

## Try an Older TypeScript Version

TypeScript 5.8.x has been reported to have performance regressions. Try downgrading:

```bash
npm install -D typescript@5.6.3
npx tsc --version  # Verify it's 5.6.3
npm run build
```

## Why This Happens

The `@modelcontextprotocol/sdk` and `zod` dependencies have complex TypeScript generic types. During type checking, TypeScript must resolve these types, which can consume significant memory. The codebase itself is small (~8K lines), but the type inference for these libraries is intensive.

TypeScript 5.8.x introduced changes to type inference that can exacerbate this issue on some systems.
