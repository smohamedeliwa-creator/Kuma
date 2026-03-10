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
`);

// ─── Step 3: Seed data (only if users table is empty) ─────────────────────────

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
    const masteringListId = insertTaskList.run(projectId, 'Mastering').lastInsertRowid;

    const task1Id = insertTask.run(
      mixingListId, 'Balance drum levels', '2025-04-01', 'in_progress', eng1Id
    ).lastInsertRowid;
    const task2Id = insertTask.run(
      mixingListId, 'Add reverb to vocals', '2025-04-05', 'todo', eng2Id
    ).lastInsertRowid;
    const task3Id = insertTask.run(
      masteringListId, 'Final loudness check', '2025-04-15', 'todo', adminId
    ).lastInsertRowid;

    insertAssignment.run(task1Id, eng1Id, 'edit');
    insertAssignment.run(task1Id, eng2Id, 'view');
    insertAssignment.run(task2Id, eng2Id, 'edit');
    insertAssignment.run(task2Id, eng3Id, 'view');
    insertAssignment.run(task3Id, adminId, 'edit');
    insertAssignment.run(task3Id, eng1Id, 'view');
    insertAssignment.run(task3Id, eng3Id, 'view');

    insertComment.run(task1Id, eng1Id, 'Kick drum is a bit too loud, adjusting now.');
    insertComment.run(task1Id, eng2Id, 'Agreed, also check the snare transient.');
    insertComment.run(task2Id, eng2Id, 'Using a plate reverb with 2.5s decay.');
    insertComment.run(task3Id, adminId, 'Target is -14 LUFS for streaming platforms.');
  });

  seed();
  console.log('Database seeded successfully.');
}

module.exports = db;
