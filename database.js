const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kuma.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Step 1: Create all tables ────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'engineer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    user_id INTEGER NOT NULL REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_list_id INTEGER NOT NULL REFERENCES task_lists(id),
    name TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    permission TEXT NOT NULL CHECK(permission IN ('edit', 'view'))
  );

  CREATE TABLE IF NOT EXISTS task_exclusions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    user_id INTEGER NOT NULL REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    invited_by INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    column_key TEXT NOT NULL,
    label TEXT NOT NULL,
    visible INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(project_id, column_key)
  );

  CREATE TABLE IF NOT EXISTS project_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#94a3b8',
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(project_id, key)
  );

  CREATE TABLE IF NOT EXISTS list_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_list_id INTEGER NOT NULL REFERENCES task_lists(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    position INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_column_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    column_id INTEGER NOT NULL REFERENCES list_columns(id),
    value TEXT NOT NULL DEFAULT 'null',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, column_id)
  );
`);

// ─── Step 2: Create indexes (tables must exist first) ─────────────────────────

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_task_list ON tasks(task_list_id);
  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
  CREATE INDEX IF NOT EXISTS idx_task_exclusions_task_user ON task_exclusions(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_list_columns_task_list ON list_columns(task_list_id);
  CREATE INDEX IF NOT EXISTS idx_task_column_values_task ON task_column_values(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_column_values_column ON task_column_values(column_id);
`);

// ─── Step 3: Migrations (add columns if missing) ──────────────────────────────

const userCols = db.pragma('table_info(users)').map(c => c.name);
if (!userCols.includes('full_name')) db.exec('ALTER TABLE users ADD COLUMN full_name TEXT');
if (!userCols.includes('avatar_color')) db.exec('ALTER TABLE users ADD COLUMN avatar_color TEXT');

const notifCols = db.pragma('table_info(notifications)').map(c => c.name);
if (!notifCols.includes('title')) db.exec('ALTER TABLE notifications ADD COLUMN title TEXT');
if (!notifCols.includes('link')) db.exec('ALTER TABLE notifications ADD COLUMN link TEXT');

const commentCols = db.pragma('table_info(comments)').map(c => c.name);
if (!commentCols.includes('type')) db.exec("ALTER TABLE comments ADD COLUMN type TEXT NOT NULL DEFAULT 'text'");
if (!commentCols.includes('file_path')) db.exec('ALTER TABLE comments ADD COLUMN file_path TEXT');
if (!commentCols.includes('file_name')) db.exec('ALTER TABLE comments ADD COLUMN file_name TEXT');
if (!commentCols.includes('file_size')) db.exec('ALTER TABLE comments ADD COLUMN file_size INTEGER');
if (!commentCols.includes('duration')) db.exec('ALTER TABLE comments ADD COLUMN duration INTEGER');
if (!commentCols.includes('deleted_at')) db.exec('ALTER TABLE comments ADD COLUMN deleted_at DATETIME');

// ─── Chat Tables ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'direct' CHECK(type IN ('direct', 'group')),
    name TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'voice', 'file')),
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    duration INTEGER,
    read_by TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON conversation_members(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
`);

// ─── Calendar Tables ──────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'event' CHECK(type IN ('event', 'meeting', 'deadline')),
    color TEXT NOT NULL DEFAULT '#0066CC',
    created_by INTEGER NOT NULL REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS event_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'declined')),
    UNIQUE(event_id, user_id)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
  CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_datetime);
  CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
  CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
`);

// ─── Pages Tables ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    icon TEXT DEFAULT '📄',
    cover_url TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    position REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'paragraph',
    content TEXT NOT NULL DEFAULT '{}',
    position REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);
  CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
  CREATE INDEX IF NOT EXISTS idx_page_blocks_page ON page_blocks(page_id);
`);

// ─── Share Links Table ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('project', 'task')),
    reference_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    expires_at DATETIME,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
  CREATE INDEX IF NOT EXISTS idx_share_links_ref ON share_links(type, reference_id);
`);

// Remove CHECK constraint on tasks.status to allow custom status keys
const taskTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
if (taskTableSql && taskTableSql.sql && taskTableSql.sql.includes('CHECK')) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE tasks_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_list_id INTEGER NOT NULL REFERENCES task_lists(id),
      name TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO tasks_new SELECT * FROM tasks;
    DROP TABLE tasks;
    ALTER TABLE tasks_new RENAME TO tasks;
  `);
  db.pragma('foreign_keys = ON');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_task_list ON tasks(task_list_id)');
}

// Seed a test notification for eng1 if they have none yet
const eng1User = db.prepare("SELECT id FROM users WHERE username = 'eng1'").get();
if (eng1User) {
  const eng1NotifCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ?').get(eng1User.id);
  if (eng1NotifCount.c === 0) {
    db.prepare("INSERT INTO notifications (user_id, type, title, message, read) VALUES (?, 'info', 'Welcome to Kuma', 'You have been added to the system', 0)")
      .run(eng1User.id);
    console.log('[database] Inserted test notification for eng1');
  }
}

// Add priority and description columns to tasks if missing
const taskCols = db.pragma('table_info(tasks)').map(c => c.name);
if (!taskCols.includes('priority')) db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
if (!taskCols.includes('description')) db.exec('ALTER TABLE tasks ADD COLUMN description TEXT');

// ─── Subtasks & Activity Tables ───────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity(task_id);
`);

// Remove "Final loudness check" seed task from live DB if it exists (Fix 4)
// Must delete child rows first to satisfy foreign key constraints
db.exec(`
  DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE name = 'Final loudness check');
  DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE name = 'Final loudness check');
  DELETE FROM tasks WHERE name = 'Final loudness check';
`);

// ─── Step 4: Seed data (only if users table is empty) ─────────────────────────

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  const SALT_ROUNDS = 10;

  const adminHash = bcrypt.hashSync('admin123', SALT_ROUNDS);
  const engHash = bcrypt.hashSync('pass123', SALT_ROUNDS);

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  );
  const insertProject = db.prepare(
    'INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)'
  );
  const insertMember = db.prepare(
    'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)'
  );
  const insertTaskList = db.prepare(
    'INSERT INTO task_lists (project_id, name) VALUES (?, ?)'
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (task_list_id, name, due_date, status, created_by) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAssignment = db.prepare(
    'INSERT INTO task_assignments (task_id, user_id, permission) VALUES (?, ?, ?)'
  );
  const insertComment = db.prepare(
    'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
  );

  const seed = db.transaction(() => {
    const adminId = insertUser.run('admin', adminHash, 'admin').lastInsertRowid;
    const eng1Id = insertUser.run('eng1', engHash, 'engineer').lastInsertRowid;
    const eng2Id = insertUser.run('eng2', engHash, 'engineer').lastInsertRowid;
    const eng3Id = insertUser.run('eng3', engHash, 'engineer').lastInsertRowid;

    const projectId = insertProject.run(
      'Album Mastering 2025',
      'Full album mixing and mastering project for 2025 release',
      adminId
    ).lastInsertRowid;

    insertMember.run(projectId, adminId);
    insertMember.run(projectId, eng1Id);
    insertMember.run(projectId, eng2Id);
    insertMember.run(projectId, eng3Id);

    const mixingListId = insertTaskList.run(projectId, 'Mixing').lastInsertRowid;
    insertTaskList.run(projectId, 'Mastering');

    const task1Id = insertTask.run(
      mixingListId, 'Balance drum levels', '2025-04-01', 'in_progress', eng1Id
    ).lastInsertRowid;
    const task2Id = insertTask.run(
      mixingListId, 'Add reverb to vocals', '2025-04-05', 'todo', eng2Id
    ).lastInsertRowid;
    insertAssignment.run(task1Id, eng1Id, 'edit');
    insertAssignment.run(task1Id, eng2Id, 'view');
    insertAssignment.run(task2Id, eng2Id, 'edit');
    insertAssignment.run(task2Id, eng3Id, 'view');

    insertComment.run(task1Id, eng1Id, 'Kick drum is a bit too loud, adjusting now.');
    insertComment.run(task1Id, eng2Id, 'Agreed, also check the snare transient.');
    insertComment.run(task2Id, eng2Id, 'Using a plate reverb with 2.5s decay.');
  });

  seed();
  console.log('Database seeded successfully.');
}

module.exports = db;
