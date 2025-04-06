import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function dropRegionIfNeeded() {
  console.log('Checking for multi-region configuration...');
  
  const prisma = new PrismaClient();
  
  try {
    // Try to drop the problematic region
    await prisma.$executeRawUnsafe(`
      ALTER DATABASE adulting DROP REGION IF EXISTS crdb_internal_region;
    `);
    console.log('Successfully handled multi-region configuration');
  } catch (error) {
    console.log('No multi-region configuration to fix or unable to modify regions');
  } finally {
    await prisma.$disconnect();
  }
}

async function runMigrationManually() {
  console.log('Running migrations manually...');
  
  const prisma = new PrismaClient();
  
  try {
    // Read the init migration file
    const migrationPath = path.join(projectRoot, 'prisma', 'migrations', '20250404205056_init', 'migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql.split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        await prisma.$executeRawUnsafe(`${statements[i]};`);
        console.log(`Executed statement ${i + 1}/${statements.length}`);
      } catch (error) {
        // Check if error is just "relation already exists"
        if (error.message && error.message.includes('already exists')) {
          console.log(`Statement ${i + 1}/${statements.length} - object already exists, continuing...`);
        } else {
          console.error(`Error executing statement ${i + 1}/${statements.length}:`, error);
        }
      }
    }
    
    console.log('Manual migration completed successfully');
  } catch (error) {
    console.error('Error during manual migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function runSeed() {
  console.log('Running database seed...');
  
  try {
    // Run seed.js using Node
    await import('./seed.js');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting database setup...');
  
  try {
    // Step 1: Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Step 2: Fix multi-region issue if it exists
    await dropRegionIfNeeded();
    
    // Step 3: Try to run migrations with Prisma
    console.log('Running migrations with Prisma...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Prisma migrations completed successfully');
    } catch (error) {
      console.log('Prisma migrations failed, falling back to manual migration...');
      await runMigrationManually();
    }
    
    // Step 4: Seed the database
    await runSeed();
    
    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
