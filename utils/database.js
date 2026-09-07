const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'bot.sqlite');
let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY, guild_name TEXT, welcome_enabled INTEGER DEFAULT 0,
    welcome_channel TEXT, welcome_message TEXT DEFAULT 'Welcome to {server}, {user}! You are member #{count}!',
    welcome_color TEXT DEFAULT '#00ff88', goodbye_enabled INTEGER DEFAULT 0, goodbye_channel TEXT,
    goodbye_message TEXT DEFAULT 'Goodbye {user}, we will miss you!', goodbye_color TEXT DEFAULT '#ff4444',
    autorole_enabled INTEGER DEFAULT 0, autorole_id TEXT, log_channel TEXT, prefix TEXT DEFAULT '!',
    boost_message TEXT DEFAULT '{user} just boosted {server}! Thank you!', boost_channel TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS welcome_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, user_tag TEXT,
    channel_id TEXT, type TEXT DEFAULT 'join', timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS commands_used (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, command TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS guild_stats (
    guild_id TEXT PRIMARY KEY, total_members INTEGER DEFAULT 0, total_welcomes INTEGER DEFAULT 0,
    total_commands INTEGER DEFAULT 0, last_updated TEXT DEFAULT (datetime('now'))
  )`);

  // Add missing columns if they don't exist
  const addColumn = (table, col, type, def) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type} DEFAULT ${def}`); } catch {}
  };
  addColumn('guilds', 'welcome_title', 'TEXT', "'Welcome!'");
  addColumn('guilds', 'welcome_footer', 'TEXT', "'Thanks for joining!'");
  addColumn('guilds', 'welcome_image', 'INTEGER', 0);

  db.run(`CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, event TEXT, userId TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, userId TEXT, moderatorId TEXT,
    reason TEXT, timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_levels (
    guild_id TEXT, user_id TEXT, xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0, messages INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS authorized_users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    authorized_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS verified_users (
    user_id TEXT,
    guild_id TEXT,
    verified_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, guild_id)
  )`);

  saveDatabase();
  console.log('\x1b[32m✓\x1b[0m Database initialized');
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

setInterval(saveDatabase, 30000);

const dbWrapper = {
  prepare(sql) {
    return {
      run(...params) { db.run(sql, params); saveDatabase(); },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          rows.push(row);
        }
        stmt.free();
        return rows;
      }
    };
  },
  exec(sql) { db.run(sql); saveDatabase(); },
  save: saveDatabase
};

module.exports = dbWrapper;
module.exports.initDatabase = initDatabase;
module.exports.saveDatabase = saveDatabase;
