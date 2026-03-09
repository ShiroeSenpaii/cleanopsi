// scripts/seed.ts
// Seeds the database with the sample customers from 04_seed_customers.csv
// Run: SEED_ORG_ID=your-uuid npx tsx scripts/seed.ts

import { readFileSync } from 'fs';
import { join } from 'path';

const ORG_ID = process.env.SEED_ORG_ID;
if (!ORG_ID) {
  console.error('Set SEED_ORG_ID environment variable to the target organisation UUID.');
  process.exit(1);
}

async function main() {
  const { parseAndImportCSV } = await import('../lib/import/parseCSV');
  const csvPath = join(__dirname, '..', '04_seed_customers.csv');
  const csvText = readFileSync(csvPath, 'utf-8');

  const result = await parseAndImportCSV(csvText, ORG_ID!);
  console.log('Seed complete:');
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Skipped:  ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log('  Errors:');
    result.errors.forEach((e) => console.log(`    Row ${e.rowIndex}: [${e.field}] ${e.message}`));
  }
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
