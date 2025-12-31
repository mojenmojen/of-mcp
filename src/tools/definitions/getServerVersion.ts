import { z } from 'zod';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const schema = z.object({});

export async function handler(_args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Get the package.json path relative to this file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    const versionInfo = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      nodeVersion: process.version,
      platform: process.platform
    };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(versionInfo, null, 2)
      }]
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      content: [{
        type: "text" as const,
        text: `Error getting server version: ${errorMessage}`
      }],
      isError: true
    };
  }
}
