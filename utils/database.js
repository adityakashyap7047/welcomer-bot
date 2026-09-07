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

  const addColumn = (table, col, type, def) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type} DEFAULT ${def}`); } catch {}
  };

  addColumn('guilds', 'welcome_title', 'TEXT', "'Welcome!'");
  addColumn('guilds', 'welcome_footer', 'TEXT', "'Thanks for joining!'");
  addColumn('guilds', 'welcome_image', 'INTEGER', 0);

  addColumn('guilds', 'anti_raid_enabled', 'INTEGER', 0);
  addColumn('guilds', 'raid_threshold', 'INTEGER', 5);
  addColumn('guilds', 'raid_window', 'INTEGER', 30);
  addColumn('guilds', 'raid_action', 'TEXT', "'kick'");
  addColumn('guilds', 'anti_spam_enabled', 'INTEGER', 0);
  addColumn('guilds', 'spam_threshold', 'INTEGER', 5);
  addColumn('guilds', 'anti_badwords_enabled', 'INTEGER', 0);
  addColumn('guilds', 'bad_words', 'TEXT', "''");
  addColumn('guilds', 'anti_caps_enabled', 'INTEGER', 0);
  addColumn('guilds', 'caps_threshold', 'INTEGER', 70);
  addColumn('guilds', 'anti_links_enabled', 'INTEGER', 0);
  addColumn('guilds', 'anti_nuke_enabled', 'INTEGER', 0);
  addColumn('guilds', 'anti_mass_mention_enabled', 'INTEGER', 0);
  addColumn('guilds', 'mass_mention_threshold', 'INTEGER', 5);
  addColumn('guilds', 'audit_log_enabled', 'INTEGER', 0);
  addColumn('guilds', 'lockdown_enabled', 'INTEGER', 0);
  addColumn('guilds', 'lockdown_channel', 'TEXT', "''");
  addColumn('guilds', 'auto_punish', 'TEXT', "'timeout'");
  addColumn('guilds', 'verification_enabled', 'INTEGER', 0);
  addColumn('guilds', 'verification_role', 'TEXT', "''");
  addColumn('guilds', 'verification_channel', 'TEXT', "''");

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

  db.run(`CREATE TABLE IF NOT EXISTS whitelisted_servers (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT,
    added_by TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS dm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    user_tag TEXT,
    channel_id TEXT,
    type TEXT DEFAULT 'join',
    timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS protection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    action TEXT,
    reason TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
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
      run(...params) {
        db.run(sql, params);
        let lastId = 0;
        let changes = 0;
        try {
          const r = db.exec('SELECT last_insert_rowid() as id, changes() as c');
          if (r.length > 0) {
            lastId = r[0].values[0][0] || 0;
            changes = r[0].values[0][1] || 0;
          }
        } catch {}
        saveDatabase();
        return { lastInsertRowid: lastId, changes };
      },
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
