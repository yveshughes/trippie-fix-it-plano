const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) {
  console.error(`Trippie requires Node 24.x; found ${process.version}. Run "nvm install && nvm use" in this project, then retry.`);
  process.exit(1);
}
try {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.prepare('SELECT 1').get();
  db.close();
  console.log(`Runtime verified: ${process.version}, built-in SQLite available.`);
} catch {
  console.error('Built-in SQLite is unavailable. Use the official Node 24.x runtime.');
  process.exit(1);
}
