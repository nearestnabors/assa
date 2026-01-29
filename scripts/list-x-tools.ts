/**
 * Script to list all available X tools from Arcade API
 * Run with: npx tsx scripts/list-x-tools.ts
 */

import 'dotenv/config';
import Arcade from '@arcadeai/arcadejs';

async function main() {
  const apiKey = process.env.ARCADE_API_KEY;

  if (!apiKey) {
    console.error('Error: ARCADE_API_KEY environment variable not set');
    process.exit(1);
  }

  const arcade = new Arcade({ apiKey });

  console.log('Fetching X tools from Arcade API...\n');

  try {
    // List all tools, filtering by X toolkit
    const tools = await arcade.tools.list({ toolkit: 'x' });

    console.log('Available X Tools:');
    console.log('==================\n');

    for await (const tool of tools) {
      console.log(`  ${tool.name}`);
      if (tool.description) {
        console.log(`    → ${tool.description}`);
      }
      console.log();
    }
  } catch (error) {
    console.error('Error fetching tools:', error);
  }
}

main();
