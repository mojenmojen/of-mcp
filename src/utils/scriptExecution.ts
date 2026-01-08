import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Increase maxBuffer for large OmniFocus databases (50MB)
// Add 30s timeout to prevent server hangs if OmniFocus is unresponsive
const EXEC_OPTIONS = {
  maxBuffer: 50 * 1024 * 1024,
  timeout: 30000
};

// Helper function to execute OmniFocus scripts
export async function executeJXA(script: string): Promise<any[]> {
  // Write the script to a temporary file in the system temp directory
  const tempFile = join(tmpdir(), `jxa_script_${Date.now()}.js`);

  try {
    // Write the script to the temporary file
    writeFileSync(tempFile, script);

    // Execute the script using osascript
    const { stdout, stderr } = await execAsync(`osascript -l JavaScript ${tempFile}`, EXEC_OPTIONS);

    if (stderr) {
      console.error("Script stderr output:", stderr);
    }

    // Parse the output as JSON
    try {
      const result = JSON.parse(stdout);
      return result;
    } catch (parseError) {
      // Don't silently swallow errors - throw with context
      const preview = stdout.substring(0, 500);
      throw new Error(`Failed to parse JXA script output as JSON. Output preview: ${preview}`);
    }
  } catch (error: any) {
    // Check for timeout (subprocess killed after timeout)
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error('Script execution timed out after 30 seconds. OmniFocus may be unresponsive.');
    }
    console.error("Failed to execute JXA script:", error);
    throw error;
  } finally {
    // Always clean up the temporary file
    try {
      unlinkSync(tempFile);
    } catch (cleanupError) {
      console.warn(`Failed to cleanup temp file ${tempFile}:`, cleanupError);
    }
  }
}

// Function to execute scripts in OmniFocus using the URL scheme
// Update src/utils/scriptExecution.ts
export async function executeOmniFocusScript(scriptPath: string, args?: any): Promise<any> {
  try {
    // Get the actual script path (existing code remains the same)
    let actualPath;
    if (scriptPath.startsWith('@')) {
      const scriptName = scriptPath.substring(1);
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      const distPath = join(__dirname, '..', 'utils', 'omnifocusScripts', scriptName);
      const srcPath = join(__dirname, '..', '..', 'src', 'utils', 'omnifocusScripts', scriptName);
      
      if (existsSync(distPath)) {
        actualPath = distPath;
      } else if (existsSync(srcPath)) {
        actualPath = srcPath;
      } else {
        actualPath = join(__dirname, '..', 'omnifocusScripts', scriptName);
      }
    } else {
      actualPath = scriptPath;
    }
    
    // Read the script file
    let scriptContent = readFileSync(actualPath, 'utf8');

    // Build parameter injection string if args are provided
    let parameterInjection = '';
    if (args && Object.keys(args).length > 0) {
      const argsJson = JSON.stringify(args);
      parameterInjection = `
    // Injected parameters
    const injectedArgs = ${argsJson};
    const perspectiveName = injectedArgs.perspectiveName || null;
    const perspectiveId = injectedArgs.perspectiveId || null;
    const hideCompleted = injectedArgs.hideCompleted !== undefined ? injectedArgs.hideCompleted : true;
    const limit = injectedArgs.limit || 100;
    const includeBuiltIn = injectedArgs.includeBuiltIn !== undefined ? injectedArgs.includeBuiltIn : false;
    const includeSidebar = injectedArgs.includeSidebar !== undefined ? injectedArgs.includeSidebar : true;
    const format = injectedArgs.format || "detailed";
    `;
    }

    // Read and prepend shared utilities (parseLocalDate, buildRRule, etc.)
    // Inject both shared utilities AND parameters in a single replacement to avoid double-match issues
    const sharedUtilsPath = join(dirname(actualPath), 'lib', 'sharedUtils.js');
    if (existsSync(sharedUtilsPath)) {
      const sharedUtils = readFileSync(sharedUtilsPath, 'utf8');
      // Inject shared utils and parameters together inside the IIFE
      scriptContent = scriptContent.replace(
        '(() => {',
        `(() => {\n${parameterInjection}\n  // === Shared utilities ===\n${sharedUtils}\n  // === End shared utilities ===\n`
      );
    } else if (parameterInjection) {
      // No shared utils, but we have parameters to inject
      scriptContent = scriptContent.replace(
        '(() => {',
        `(() => {\n${parameterInjection}`
      );
    }
    
    // Escape the script content properly for use in JXA
    const escapedScript = scriptContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    // Create a JXA script that will execute our OmniJS script in OmniFocus
    const jxaScript = `
    function run() {
      try {
        const app = Application('OmniFocus');
        app.includeStandardAdditions = true;

        // Run the OmniJS script in OmniFocus and capture the output
        const result = app.evaluateJavascript(\`${escapedScript}\`);

        // Return the result
        return result;
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    }
    `;

    // Create a temporary file for our JXA wrapper script
    const tempFile = join(tmpdir(), `jxa_wrapper_${Date.now()}.js`);

    try {
      // Write the JXA script to the temporary file
      writeFileSync(tempFile, jxaScript);

      // Execute the JXA script using osascript
      const { stdout, stderr } = await execAsync(`osascript -l JavaScript ${tempFile}`, EXEC_OPTIONS);

      if (stderr) {
        console.error("Script stderr output:", stderr);
      }

      // Parse the output as JSON
      try {
        return JSON.parse(stdout);
      } catch (parseError) {
        // If JSON parsing fails, throw with context instead of silently returning raw stdout
        const preview = stdout.substring(0, 500);
        throw new Error(`Failed to parse OmniFocus script output as JSON. Output preview: ${preview}`);
      }
    } finally {
      // Always clean up the temporary file
      try {
        unlinkSync(tempFile);
      } catch (cleanupError) {
        console.warn(`Failed to cleanup temp file ${tempFile}:`, cleanupError);
      }
    }
  } catch (error: any) {
    // Check for timeout (subprocess killed after timeout)
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error('Script execution timed out after 30 seconds. OmniFocus may be unresponsive.');
    }
    console.error("Failed to execute OmniFocus script:", error);
    throw error;
  }
}
    