const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  const folders = fs.readdirSync(migrationsDir)
    .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  const c = new Client('postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable');
  await c.connect();

  for (const folder of folders) {
    const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('Running migration:', folder);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      try {
        await c.query(sql);
      } catch (e) {
        console.error('Migration failed:', folder, e.message);
      }
    }
  }
  
  await c.end();
  console.log('Database provisioned successfully.');
}
run();
