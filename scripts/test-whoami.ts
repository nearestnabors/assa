/**
 * Test X.WhoAmI
 * Run with: npx tsx scripts/test-whoami.ts
 */

import 'dotenv/config';
import Arcade from '@arcadeai/arcadejs';

async function main() {
  const apiKey = process.env.ARCADE_API_KEY;
  const userId = process.env.ARCADE_USER_ID;

  if (!apiKey || !userId) {
    console.error('Error: ARCADE_API_KEY and ARCADE_USER_ID must be set in .env');
    process.exit(1);
  }

  const arcade = new Arcade({ apiKey });

  console.log(`Using user_id: ${userId}`);
  console.log('Testing X.WhoAmI...\n');

  try {
    const result = await arcade.tools.execute({
      tool_name: 'X.WhoAmI',
      user_id: userId,
      input: {},
    });

    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
