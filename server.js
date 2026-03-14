const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── File Uploads Setup ────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Trust Railway's HTTPS proxy so req.secure works correctly
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || 'kuma-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ─── Security Headers ─────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const loginAttempts = new Map(); // ip -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

const VALID_PERMISSION = ['edit', 'view'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME_LEN = 200;
const MAX_DESC_LEN = 2000;
const MAX_COMMENT_LEN = 5000;

function validateName(val, field = 'Name') {
  if (!val || typeof val !== 'string' || !val.trim()) return `${field} is required`;
  if (val.trim().length > MAX_NAME_LEN) return `${field} must be ${MAX_NAME_LEN} characters or fewer`;
  return null;
}

function validateDate(val) {
  if (!val) return null; // optional
  if (!DATE_REGEX.test(val)) return 'Invalid date format — use YYYY-MM-DD';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'Invalid date value';
  return null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (checkRateLimit(ip)) return res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  req.session.role = user.role;

  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── Project Routes ───────────────────────────────────────────────────────────

const PROJECT_STATS_SQL = `
  SELECT p.*, u.username as created_by_name,
    COUNT(DISTINCT t.id) as task_count,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
    (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
  FROM projects p
  JOIN users u ON p.created_by = u.id
  LEFT JOIN task_lists tl ON tl.project_id = p.id
  LEFT JOIN tasks t ON t.task_list_id = tl.id
`;

app.get('/api/projects', requireAuth, (req, res) => {
  let projects;
  if (req.session.role === 'admin') {
    projects = db.prepare(PROJECT_STATS_SQL + ' GROUP BY p.id').all();
  } else {
    projects = db.prepare(
      PROJECT_STATS_SQL +
      ' JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? GROUP BY p.id'
    ).all(req.session.userId);
  }
  res.json(projects);
});

app.put('/api/projects/:id', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const { name, description } = req.body;
  const nameErr = validateName(name, 'Project name');
  if (nameErr) return res.status(400).json({ error: nameErr });
  if (description && description.length > MAX_DESC_LEN)
    return res.status(400).json({ error: `Description must be ${MAX_DESC_LEN} characters or fewer` });

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?')
    .run(name.trim(), description?.trim() || null, projectId);

  const updated = db.prepare(
    PROJECT_STATS_SQL + ' WHERE p.id = ? GROUP BY p.id'
  ).get(projectId);
  res.json(updated);
});

app.delete('/api/projects/:id', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.transaction(() => {
    const lists = db.prepare('SELECT id FROM task_lists WHERE project_id = ?').all(projectId);
    for (const list of lists) {
      const tasks = db.prepare('SELECT id FROM tasks WHERE task_list_id = ?').all(list.id);
      for (const task of tasks) {
        db.prepare('DELETE FROM comments WHERE task_id = ?').run(task.id);
        db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(task.id);
        db.prepare('DELETE FROM task_exclusions WHERE task_id = ?').run(task.id);
        db.prepare('DELETE FROM task_column_values WHERE task_id = ?').run(task.id);
      }
      db.prepare('DELETE FROM tasks WHERE task_list_id = ?').run(list.id);
      db.prepare('DELETE FROM list_columns WHERE task_list_id = ?').run(list.id);
    }
    db.prepare('DELETE FROM task_lists WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  })();

  res.json({ message: 'Project deleted' });
});

app.post('/api/projects', requireAdmin, (req, res) => {
  const { name, description } = req.body;
  const nameErr = validateName(name, 'Project name');
  if (nameErr) return res.status(400).json({ error: nameErr });
  if (description && description.length > MAX_DESC_LEN)
    return res.status(400).json({ error: `Description must be ${MAX_DESC_LEN} characters or fewer` });

  const result = db.prepare(
    'INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)'
  ).run(name.trim(), description?.trim() || null, req.session.userId);

  // Auto-add admin as member
  db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.session.userId);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare(`
    SELECT p.*, u.username as created_by_name
    FROM projects p JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `).get(projectId);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Engineers must be members
  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.prepare(`
    SELECT u.id, u.username, u.role
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(projectId);

  res.json({ ...project, members });
});

app.post('/api/projects/:id/members', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const user = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  if (existing) return res.status(409).json({ error: 'User already a member' });

  db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, userId);
  res.status(201).json({ message: 'Member added' });
});

app.delete('/api/projects/:id/members/:userId', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  const result = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });
  res.json({ message: 'Member removed' });
});

// ─── Task List Routes ─────────────────────────────────────────────────────────

app.get('/api/projects/:id/task-lists', requireAuth, (req, res) => {
  const projectId = parseInt(req.params.id);

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  const lists = db.prepare('SELECT * FROM task_lists WHERE project_id = ?').all(projectId);
  res.json(lists);
});

app.post('/api/projects/:id/task-lists', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const { name } = req.body;
  const nameErr = validateName(name, 'Task list name');
  if (nameErr) return res.status(400).json({ error: nameErr });

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const result = db.prepare('INSERT INTO task_lists (project_id, name) VALUES (?, ?)').run(projectId, name.trim());
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(list);
});

app.put('/api/task-lists/:id', requireAdmin, (req, res) => {
  const listId = parseInt(req.params.id);
  const { name } = req.body;
  const nameErr = validateName(name, 'Task list name');
  if (nameErr) return res.status(400).json({ error: nameErr });

  const list = db.prepare('SELECT 1 FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });

  db.prepare('UPDATE task_lists SET name = ? WHERE id = ?').run(name.trim(), listId);
  const updated = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  res.json(updated);
});

app.delete('/api/task-lists/:id', requireAdmin, (req, res) => {
  const listId = parseInt(req.params.id);

  const list = db.prepare('SELECT 1 FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });

  db.transaction(() => {
    const tasks = db.prepare('SELECT id FROM tasks WHERE task_list_id = ?').all(listId);
    for (const task of tasks) {
      db.prepare('DELETE FROM comments WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM task_exclusions WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM task_column_values WHERE task_id = ?').run(task.id);
    }
    db.prepare('DELETE FROM tasks WHERE task_list_id = ?').run(listId);
    db.prepare('DELETE FROM list_columns WHERE task_list_id = ?').run(listId);
    db.prepare('DELETE FROM task_lists WHERE id = ?').run(listId);
  })();

  res.json({ message: 'Task list deleted' });
});

// ─── Custom Column Routes ─────────────────────────────────────────────────────

const VALID_COL_TYPES = ['text', 'number', 'select', 'multi_select', 'status', 'date', 'person', 'file', 'url', 'checkbox'];
const MAX_COL_NAME_LEN = 100;

app.get('/api/task-lists/:id/columns', requireAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });
  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(list.project_id, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }
  const cols = db.prepare('SELECT * FROM list_columns WHERE task_list_id = ? ORDER BY position ASC').all(listId);
  res.json(cols.map(c => ({ ...c, config: JSON.parse(c.config || '{}') })));
});

app.post('/api/task-lists/:id/columns', requireAdmin, (req, res) => {
  const listId = parseInt(req.params.id);
  const { name, type = 'text', config = {} } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Column name is required' });
  if (name.trim().length > MAX_COL_NAME_LEN) return res.status(400).json({ error: `Column name must be ${MAX_COL_NAME_LEN} characters or fewer` });
  if (!VALID_COL_TYPES.includes(type)) return res.status(400).json({ error: `Type must be one of: ${VALID_COL_TYPES.join(', ')}` });
  const list = db.prepare('SELECT 1 FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });
  const maxPos = db.prepare('SELECT MAX(position) as m FROM list_columns WHERE task_list_id = ?').get(listId);
  const nextPos = (maxPos?.m ?? -1) + 1;
  const result = db.prepare('INSERT INTO list_columns (task_list_id, name, type, position, config) VALUES (?, ?, ?, ?, ?)').run(listId, name.trim(), type, nextPos, JSON.stringify(config));
  const col = db.prepare('SELECT * FROM list_columns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...col, config: JSON.parse(col.config) });
});

app.put('/api/task-lists/:id/columns/reorder', requireAdmin, (req, res) => {
  const listId = parseInt(req.params.id);
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const list = db.prepare('SELECT 1 FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });
  const update = db.prepare('UPDATE list_columns SET position = ? WHERE id = ? AND task_list_id = ?');
  db.transaction(() => { ids.forEach((id, i) => update.run(i, id, listId)); })();
  const cols = db.prepare('SELECT * FROM list_columns WHERE task_list_id = ? ORDER BY position ASC').all(listId);
  res.json(cols.map(c => ({ ...c, config: JSON.parse(c.config || '{}') })));
});

app.get('/api/task-lists/:id/column-values', requireAuth, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });
  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(list.project_id, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }
  const values = db.prepare(`
    SELECT tcv.* FROM task_column_values tcv
    JOIN tasks t ON t.id = tcv.task_id
    WHERE t.task_list_id = ?
  `).all(listId);
  res.json(values.map(v => ({ ...v, value: JSON.parse(v.value) })));
});

app.put('/api/columns/:id', requireAdmin, (req, res) => {
  const colId = parseInt(req.params.id);
  const col = db.prepare('SELECT * FROM list_columns WHERE id = ?').get(colId);
  if (!col) return res.status(404).json({ error: 'Column not found' });
  const newName = (req.body.name !== undefined) ? (req.body.name.trim() || col.name) : col.name;
  if (newName.length > MAX_COL_NAME_LEN) return res.status(400).json({ error: `Column name must be ${MAX_COL_NAME_LEN} characters or fewer` });
  const newConfig = (req.body.config !== undefined) ? JSON.stringify(req.body.config) : col.config;
  db.prepare('UPDATE list_columns SET name = ?, config = ? WHERE id = ?').run(newName, newConfig, colId);
  const updated = db.prepare('SELECT * FROM list_columns WHERE id = ?').get(colId);
  res.json({ ...updated, config: JSON.parse(updated.config) });
});

app.delete('/api/columns/:id', requireAdmin, (req, res) => {
  const colId = parseInt(req.params.id);
  const col = db.prepare('SELECT 1 FROM list_columns WHERE id = ?').get(colId);
  if (!col) return res.status(404).json({ error: 'Column not found' });
  db.transaction(() => {
    db.prepare('DELETE FROM task_column_values WHERE column_id = ?').run(colId);
    db.prepare('DELETE FROM list_columns WHERE id = ?').run(colId);
  })();
  res.json({ message: 'Column deleted' });
});

// ─── Task Routes ──────────────────────────────────────────────────────────────

app.get('/api/task-lists/:id/tasks', requireAuth, (req, res) => {
  const listId = parseInt(req.params.id);

  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });

  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(list.project_id, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  const TASK_WITH_ASSIGNEES = `
    SELECT t.*,
      GROUP_CONCAT(u.username, ', ') FILTER (WHERE ta.permission = 'edit') as assignee_names
    FROM tasks t
    LEFT JOIN task_assignments ta ON ta.task_id = t.id
    LEFT JOIN users u ON u.id = ta.user_id
  `;

  let tasks;
  if (req.session.role === 'admin') {
    tasks = db.prepare(
      TASK_WITH_ASSIGNEES + ' WHERE t.task_list_id = ? GROUP BY t.id'
    ).all(listId);
  } else {
    // Show tasks where user is assigned AND not excluded
    tasks = db.prepare(`
      SELECT t.*,
        GROUP_CONCAT(u2.username, ', ') FILTER (WHERE ta2.permission = 'edit') as assignee_names
      FROM tasks t
      JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = ?
      LEFT JOIN task_assignments ta2 ON ta2.task_id = t.id
      LEFT JOIN users u2 ON u2.id = ta2.user_id
      WHERE t.task_list_id = ?
        AND t.id NOT IN (
          SELECT task_id FROM task_exclusions WHERE user_id = ?
        )
      GROUP BY t.id
    `).all(req.session.userId, listId, req.session.userId);
  }

  res.json(tasks);
});

app.post('/api/task-lists/:id/tasks', requireAdmin, (req, res) => {
  const listId = parseInt(req.params.id);
  const { name, due_date, status = 'todo', assignees = [] } = req.body;

  const nameErr = validateName(name, 'Task name');
  if (nameErr) return res.status(400).json({ error: nameErr });

  const dateErr = validateDate(due_date);
  if (dateErr) return res.status(400).json({ error: dateErr });

  if (!Array.isArray(assignees))
    return res.status(400).json({ error: 'assignees must be an array' });

  const list = db.prepare('SELECT * FROM task_lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'Task list not found' });

  const validStatuses = getStatusKeys(list.project_id);
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });

  const createTask = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO tasks (task_list_id, name, due_date, status, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(listId, name.trim(), due_date || null, status, req.session.userId);

    const taskId = result.lastInsertRowid;

    const insertAssignment = db.prepare(
      'INSERT INTO task_assignments (task_id, user_id, permission) VALUES (?, ?, ?)'
    );
    for (const { userId, permission } of assignees) {
      if (!VALID_PERMISSION.includes(permission)) continue;
      const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
      if (userExists) insertAssignment.run(taskId, userId, permission);
    }

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  });

  const task = createTask();
  res.status(201).json(task);
});

app.get('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.session.role !== 'admin') {
    const excluded = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (excluded) return res.status(403).json({ error: 'Access denied' });

    const assigned = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assigned) return res.status(403).json({ error: 'Access denied' });
  }

  const assignments = db.prepare(`
    SELECT ta.permission, u.id, u.username
    FROM task_assignments ta JOIN users u ON ta.user_id = u.id
    WHERE ta.task_id = ?
  `).all(taskId);

  res.json({ ...task, assignments });
});

app.get('/api/tasks/:id/column-values', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.session.role !== 'admin') {
    const excluded = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (excluded) return res.status(403).json({ error: 'Access denied' });
    const assigned = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assigned) return res.status(403).json({ error: 'Access denied' });
  }
  const values = db.prepare('SELECT * FROM task_column_values WHERE task_id = ?').all(taskId);
  res.json(values.map(v => ({ ...v, value: JSON.parse(v.value) })));
});

app.put('/api/tasks/:id/column-values', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { values } = req.body;
  if (!Array.isArray(values)) return res.status(400).json({ error: 'values must be an array' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.session.role !== 'admin') {
    const assignment = db.prepare('SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assignment || assignment.permission !== 'edit') return res.status(403).json({ error: 'Edit permission required' });
  }
  const upsert = db.prepare(`
    INSERT INTO task_column_values (task_id, column_id, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(task_id, column_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  db.transaction(() => {
    for (const { column_id, value } of values) {
      const col = db.prepare('SELECT 1 FROM list_columns WHERE id = ? AND task_list_id = ?').get(column_id, task.task_list_id);
      if (!col) continue;
      upsert.run(taskId, column_id, JSON.stringify(value));
    }
  })();
  const updated = db.prepare('SELECT * FROM task_column_values WHERE task_id = ?').all(taskId);
  res.json(updated.map(v => ({ ...v, value: JSON.parse(v.value) })));
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { name, due_date, status } = req.body;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.session.role !== 'admin') {
    const assignment = db.prepare('SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assignment || assignment.permission !== 'edit') return res.status(403).json({ error: 'Edit permission required' });
  }

  const updates = {};
  if (name !== undefined) {
    const nameErr = validateName(name, 'Task name');
    if (nameErr) return res.status(400).json({ error: nameErr });
    updates.name = name.trim();
  }
  if (due_date !== undefined) {
    const dateErr = validateDate(due_date);
    if (dateErr) return res.status(400).json({ error: dateErr });
    updates.due_date = due_date || null;
  }
  if (status !== undefined) {
    const taskList = db.prepare('SELECT project_id FROM task_lists WHERE id = ?').get(task.task_list_id);
    const validStatuses = taskList ? getStatusKeys(taskList.project_id) : [];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...Object.values(updates), taskId);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  // Notify assignees of status change
  if (updates.status && updates.status !== task.status) {
    const taskList2 = db.prepare('SELECT project_id FROM task_lists WHERE id = ?').get(task.task_list_id);
    const statusRows = taskList2 ? getOrSeedStatuses(taskList2.project_id) : [];
    const statusLabel = statusRows.find(s => s.key === updates.status)?.label || updates.status;
    const otherAssignees = db.prepare(
      'SELECT user_id FROM task_assignments WHERE task_id = ? AND user_id != ?'
    ).all(taskId, req.session.userId);
    for (const { user_id } of otherAssignees) {
      createNotification(user_id, 'status', 'Task Status Updated',
        `"${task.name}" was moved to ${statusLabel}`, `/tasks/${taskId}`);
    }
  }

  res.json(updated);
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.session.role !== 'admin') {
    // Must be primary assignee (first edit-permission assignment)
    const primary = db.prepare(`
      SELECT * FROM task_assignments WHERE task_id = ? AND permission = 'edit'
      ORDER BY id ASC LIMIT 1
    `).get(taskId);
    if (!primary || primary.user_id !== req.session.userId) return res.status(403).json({ error: 'Only the primary assignee can delete this task' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM comments WHERE task_id = ?').run(taskId);
    db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(taskId);
    db.prepare('DELETE FROM task_exclusions WHERE task_id = ?').run(taskId);
    db.prepare('DELETE FROM task_column_values WHERE task_id = ?').run(taskId);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  })();

  res.json({ message: 'Task deleted' });
});

// ─── Task Permission Routes ───────────────────────────────────────────────────

app.post('/api/tasks/:id/assignments', requireAdmin, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { userId, permission } = req.body;

  if (!userId || !permission) return res.status(400).json({ error: 'userId and permission required' });
  if (!['edit', 'view'].includes(permission)) return res.status(400).json({ error: 'Permission must be edit or view' });

  const task = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const user = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, userId);
  if (existing) return res.status(409).json({ error: 'Assignment already exists' });

  db.prepare('INSERT INTO task_assignments (task_id, user_id, permission) VALUES (?, ?, ?)').run(taskId, userId, permission);

  // Notify assigned user (if not self)
  if (userId !== req.session.userId) {
    const task = db.prepare('SELECT name FROM tasks WHERE id = ?').get(taskId);
    if (task) {
      createNotification(userId, 'assignment', 'New Task Assigned',
        `You were assigned to "${task.name}"`, `/tasks/${taskId}`);
    }
  }

  res.status(201).json({ message: 'Assignment created' });
});

app.put('/api/tasks/:id/assignments/:userId', requireAdmin, (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const { permission } = req.body;

  if (!permission || !['edit', 'view'].includes(permission)) return res.status(400).json({ error: 'Permission must be edit or view' });

  const result = db.prepare('UPDATE task_assignments SET permission = ? WHERE task_id = ? AND user_id = ?').run(permission, taskId, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ message: 'Permission updated' });
});

app.delete('/api/tasks/:id/assignments/:userId', requireAdmin, (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  const result = db.prepare('DELETE FROM task_assignments WHERE task_id = ? AND user_id = ?').run(taskId, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ message: 'Assignment removed' });
});

app.post('/api/tasks/:id/exclusions', requireAdmin, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const task = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const user = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, userId);
  if (existing) return res.status(409).json({ error: 'Exclusion already exists' });

  db.prepare('INSERT INTO task_exclusions (task_id, user_id) VALUES (?, ?)').run(taskId, userId);
  res.status(201).json({ message: 'User excluded from task' });
});

app.delete('/api/tasks/:id/exclusions/:userId', requireAdmin, (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  const result = db.prepare('DELETE FROM task_exclusions WHERE task_id = ? AND user_id = ?').run(taskId, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Exclusion not found' });
  res.json({ message: 'Exclusion removed' });
});

// ─── Comment Routes ───────────────────────────────────────────────────────────

app.get('/api/tasks/:id/comments', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);

  const task = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.session.role !== 'admin') {
    const excluded = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (excluded) return res.status(403).json({ error: 'Access denied' });

    const assigned = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assigned) return res.status(403).json({ error: 'Access denied' });
  }

  const comments = db.prepare(`
    SELECT c.*, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId);

  res.json(comments);
});

app.post('/api/tasks/:id/comments', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: 'Comment content is required' });
  if (content.trim().length > MAX_COMMENT_LEN)
    return res.status(400).json({ error: `Comment must be ${MAX_COMMENT_LEN} characters or fewer` });

  const task = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.session.role !== 'admin') {
    const excluded = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (excluded) return res.status(403).json({ error: 'Access denied' });

    const assignment = db.prepare('SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assignment || assignment.permission !== 'edit') return res.status(403).json({ error: 'Edit permission required to comment' });
  }

  const result = db.prepare('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)').run(taskId, req.session.userId, content.trim());
  const comment = db.prepare(`
    SELECT c.*, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  // Notify other assignees of the new comment
  const commentTask = db.prepare('SELECT name FROM tasks WHERE id = ?').get(taskId);
  if (commentTask) {
    const otherAssignees = db.prepare(
      'SELECT user_id FROM task_assignments WHERE task_id = ? AND user_id != ?'
    ).all(taskId, req.session.userId);
    for (const { user_id } of otherAssignees) {
      createNotification(user_id, 'comment', 'New Comment',
        `${comment.username} commented on "${commentTask.name}"`, `/tasks/${taskId}`);
    }
  }

  res.status(201).json(comment);
});

app.post('/api/tasks/:id/comments/upload', requireAuth, upload.single('file'), (req, res) => {
  const taskId = parseInt(req.params.id);
  const { type, duration } = req.body;

  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const allowedTypes = ['voice', 'file'];
  if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid comment type' });

  if (type === 'voice') {
    const voiceMimes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    if (!voiceMimes.includes(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Invalid audio format' });
    }
  }

  const task = db.prepare('SELECT name FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Task not found' });
  }

  if (req.session.role !== 'admin') {
    const excluded = db.prepare('SELECT 1 FROM task_exclusions WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (excluded) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ error: 'Access denied' }); }

    const assignment = db.prepare('SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?').get(taskId, req.session.userId);
    if (!assignment || assignment.permission !== 'edit') {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Edit permission required to comment' });
    }
  }

  const durationVal = type === 'voice' && duration ? parseInt(duration) : null;
  const result = db.prepare(
    'INSERT INTO comments (task_id, user_id, content, type, file_path, file_name, file_size, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(taskId, req.session.userId, '', type, req.file.filename, req.file.originalname, req.file.size, durationVal);

  const comment = db.prepare(`
    SELECT c.*, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  const otherAssignees = db.prepare(
    'SELECT user_id FROM task_assignments WHERE task_id = ? AND user_id != ?'
  ).all(taskId, req.session.userId);

  const notifTitle = type === 'voice' ? 'New Voice Note' : 'New File Attachment';
  const notifMsg = type === 'voice'
    ? `${comment.username} sent a voice note on "${task.name}"`
    : `${comment.username} attached a file to "${task.name}"`;

  for (const { user_id } of otherAssignees) {
    createNotification(user_id, 'comment', notifTitle, notifMsg, `/tasks/${taskId}`);
  }

  res.status(201).json(comment);
});

app.delete('/api/comments/:id', requireAuth, (req, res) => {
  const commentId = parseInt(req.params.id);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.deleted_at) return res.status(404).json({ error: 'Comment not found' });

  if (req.session.role !== 'admin' && comment.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Not authorized to delete this comment' });
  }

  db.prepare('UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(commentId);
  res.status(204).end();
});

// ─── Profile Routes ───────────────────────────────────────────────────────────

app.get('/api/profile', requireAuth, (req, res) => {
  const userId = req.session.userId;

  const user = db.prepare('SELECT id, username, role, full_name, avatar_color, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Task counts by status
  const taskStats = db.prepare(`
    SELECT t.status, COUNT(*) as count
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = ?
    WHERE t.id NOT IN (SELECT task_id FROM task_exclusions WHERE user_id = ?)
    GROUP BY t.status
  `).all(userId, userId);

  const statusMap = { todo: 0, in_progress: 0, done: 0 };
  for (const row of taskStats) statusMap[row.status] = row.count;

  // Overdue count (due_date < today, not done)
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = ?
    WHERE t.due_date IS NOT NULL AND t.due_date < ? AND t.status != 'done'
      AND t.id NOT IN (SELECT task_id FROM task_exclusions WHERE user_id = ?)
  `).get(userId, today, userId).count;

  // Projects with progress
  const projects = db.prepare(`
    SELECT p.id, p.name,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    LEFT JOIN task_lists tl ON tl.project_id = p.id
    LEFT JOIN tasks t ON t.task_list_id = tl.id
    GROUP BY p.id
  `).all(userId);

  // Recent activity (last 5 comments by this user)
  const recentActivity = db.prepare(`
    SELECT c.id, c.content, c.created_at, t.name as task_name, t.id as task_id, p.name as project_name, p.id as project_id
    FROM comments c
    JOIN tasks t ON t.id = c.task_id
    JOIN task_lists tl ON tl.id = t.task_list_id
    JOIN projects p ON p.id = tl.project_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
    LIMIT 5
  `).all(userId);

  res.json({
    user,
    stats: { ...statusMap, overdue: overdueCount },
    projects,
    recentActivity,
  });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { full_name, avatar_color } = req.body;

  if (full_name !== undefined && full_name.length > 100)
    return res.status(400).json({ error: 'Full name must be 100 characters or fewer' });

  db.prepare('UPDATE users SET full_name = ?, avatar_color = ? WHERE id = ?')
    .run(full_name?.trim() || null, avatar_color || null, userId);

  const user = db.prepare('SELECT id, username, role, full_name, avatar_color, created_at FROM users WHERE id = ?').get(userId);
  res.json(user);
});

// ─── Notification Routes ──────────────────────────────────────────────────────

function createNotification(userId, type, title, message, link = null) {
  db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message, link);
}

app.get('/api/notifications', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.session.userId);
  res.json(notifications);
});

app.get('/api/notifications/unread-count', requireAuth, (req, res) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.session.userId);
  res.json({ count: result.count });
});

app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, req.session.userId);
  res.json({ message: 'Marked as read' });
});

app.put('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.session.userId);
  res.json({ message: 'All marked as read' });
});

// ─── Project Statuses Routes ──────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  { key: 'todo',        label: 'To Do',       color: '#94a3b8', position: 0 },
  { key: 'in_progress', label: 'In Progress',  color: '#3b82f6', position: 1 },
  { key: 'done',        label: 'Done',         color: '#22c55e', position: 2 },
];

function getOrSeedStatuses(projectId) {
  let rows = db.prepare('SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC').all(projectId);
  if (rows.length === 0) {
    const insert = db.prepare('INSERT INTO project_statuses (project_id, key, label, color, position) VALUES (?, ?, ?, ?, ?)');
    db.transaction(() => {
      for (const s of DEFAULT_STATUSES) insert.run(projectId, s.key, s.label, s.color, s.position);
    })();
    rows = db.prepare('SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC').all(projectId);
  }
  return rows;
}

function getStatusKeys(projectId) {
  const rows = getOrSeedStatuses(projectId);
  return rows.map(r => r.key);
}

app.get('/api/projects/:id/statuses', requireAuth, (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }
  res.json(getOrSeedStatuses(projectId));
});

app.post('/api/projects/:id/statuses', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  let { key, label, color } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
  // Auto-generate key from label if not provided
  if (!key) key = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!key) return res.status(400).json({ error: 'Invalid key' });

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const existing = db.prepare('SELECT 1 FROM project_statuses WHERE project_id = ? AND key = ?').get(projectId, key);
  if (existing) return res.status(409).json({ error: 'A status with this key already exists' });

  // Ensure defaults seeded first
  getOrSeedStatuses(projectId);
  const maxPos = db.prepare('SELECT MAX(position) as m FROM project_statuses WHERE project_id = ?').get(projectId).m || 0;
  const result = db.prepare('INSERT INTO project_statuses (project_id, key, label, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, key, label.trim(), color || '#94a3b8', maxPos + 1);
  const row = db.prepare('SELECT * FROM project_statuses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

app.put('/api/projects/:id/statuses/:statusId', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const statusId = parseInt(req.params.statusId);
  const { label, color } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });

  const row = db.prepare('SELECT 1 FROM project_statuses WHERE id = ? AND project_id = ?').get(statusId, projectId);
  if (!row) return res.status(404).json({ error: 'Status not found' });

  db.prepare('UPDATE project_statuses SET label = ?, color = ? WHERE id = ?').run(label.trim(), color || '#94a3b8', statusId);
  res.json(db.prepare('SELECT * FROM project_statuses WHERE id = ?').get(statusId));
});

app.delete('/api/projects/:id/statuses/:statusId', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const statusId = parseInt(req.params.statusId);

  const row = db.prepare('SELECT * FROM project_statuses WHERE id = ? AND project_id = ?').get(statusId, projectId);
  if (!row) return res.status(404).json({ error: 'Status not found' });

  const usageCount = db.prepare(`
    SELECT COUNT(*) as count FROM tasks t
    JOIN task_lists tl ON tl.id = t.task_list_id
    WHERE tl.project_id = ? AND t.status = ?
  `).get(projectId, row.key).count;
  if (usageCount > 0) return res.status(409).json({ error: `Cannot delete: ${usageCount} task(s) use this status` });

  // Ensure at least 1 status remains
  const total = db.prepare('SELECT COUNT(*) as count FROM project_statuses WHERE project_id = ?').get(projectId).count;
  if (total <= 1) return res.status(400).json({ error: 'A project must have at least one status' });

  db.prepare('DELETE FROM project_statuses WHERE id = ?').run(statusId);
  res.json({ message: 'Status deleted' });
});

// ─── Project Columns Routes ───────────────────────────────────────────────────

const DEFAULT_COLUMNS = [
  { column_key: 'name',      label: 'Task Name',   visible: 1, position: 0 },
  { column_key: 'due_date',  label: 'Due Date',    visible: 1, position: 1 },
  { column_key: 'status',    label: 'Status',      visible: 1, position: 2 },
  { column_key: 'assignees', label: 'Assigned To', visible: 1, position: 3 },
];

function getOrSeedColumns(projectId) {
  let cols = db.prepare('SELECT * FROM project_columns WHERE project_id = ? ORDER BY position ASC').all(projectId);
  if (cols.length === 0) {
    const insert = db.prepare('INSERT INTO project_columns (project_id, column_key, label, visible, position) VALUES (?, ?, ?, ?, ?)');
    db.transaction(() => {
      for (const c of DEFAULT_COLUMNS) insert.run(projectId, c.column_key, c.label, c.visible, c.position);
    })();
    cols = db.prepare('SELECT * FROM project_columns WHERE project_id = ? ORDER BY position ASC').all(projectId);
  }
  return cols;
}

app.get('/api/projects/:id/columns', requireAuth, (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.session.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.session.userId);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  res.json(getOrSeedColumns(projectId));
});

app.put('/api/projects/:id/columns', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const { columns } = req.body; // Array of { column_key, label, visible }
  if (!Array.isArray(columns)) return res.status(400).json({ error: 'columns must be an array' });

  const project = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Ensure rows exist first
  getOrSeedColumns(projectId);

  const update = db.prepare('UPDATE project_columns SET label = ?, visible = ? WHERE project_id = ? AND column_key = ?');
  db.transaction(() => {
    for (const col of columns) {
      if (!col.column_key || typeof col.label !== 'string') continue;
      const label = col.label.trim() || DEFAULT_COLUMNS.find(d => d.column_key === col.column_key)?.label || col.column_key;
      // 'name' column is always visible
      const visible = col.column_key === 'name' ? 1 : (col.visible ? 1 : 0);
      update.run(label, visible, projectId, col.column_key);
    }
  })();

  res.json(getOrSeedColumns(projectId));
});

// ─── Invitation Routes ────────────────────────────────────────────────────────

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// POST /api/projects/:id/invite — admin sends invite email
app.post('/api/projects/:id/invite', requireAdmin, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@'))
    return res.status(400).json({ error: 'Valid email required' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check email not already a registered user who is already a member
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(email.trim().toLowerCase());
  if (existingUser) {
    const alreadyMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, existingUser.id);
    if (alreadyMember) return res.status(409).json({ error: 'User is already a project member' });
  }

  // Expire old pending invitations for same email+project
  db.prepare(`UPDATE invitations SET status = 'expired' WHERE email = ? AND project_id = ? AND status = 'pending'`)
    .run(email.trim().toLowerCase(), projectId);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare('INSERT INTO invitations (token, email, project_id, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, email.trim().toLowerCase(), projectId, req.session.userId, expiresAt);

  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const inviteUrl = `${appUrl}/invite/${token}`;

  const mailer = getMailer();
  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email.trim(),
        subject: `You've been invited to join "${project.name}" on Kuma`,
        html: `
          <p>You've been invited to collaborate on <strong>${project.name}</strong> in Kuma.</p>
          <p><a href="${inviteUrl}" style="background:#0066CC;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0">Accept Invitation</a></p>
          <p>This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
          <p style="color:#888;font-size:12px">Or copy this link: ${inviteUrl}</p>
        `,
      });
    } catch (err) {
      console.error('Email send failed:', err.message);
      // Still return success — invite link usable manually
    }
  }

  res.status(201).json({ message: 'Invitation sent', inviteUrl, emailSent: !!mailer });
});

// GET /api/invitations/:token — public, validate token
app.get('/api/invitations/:token', (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, p.name as project_name, u.username as invited_by_name
    FROM invitations i
    JOIN projects p ON p.id = i.project_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token = ?
  `).get(req.params.token);

  if (!inv) return res.status(404).json({ error: 'Invitation not found' });
  if (inv.status === 'accepted') return res.status(410).json({ error: 'This invitation has already been used' });
  if (inv.status === 'expired' || new Date(inv.expires_at) < new Date())
    return res.status(410).json({ error: 'This invitation has expired' });

  res.json({
    email: inv.email,
    projectName: inv.project_name,
    invitedBy: inv.invited_by_name,
    expiresAt: inv.expires_at,
  });
});

// POST /api/invitations/:token/accept — register + join project
app.post('/api/invitations/:token/accept', async (req, res) => {
  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || !username.trim())
    return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const inv = db.prepare('SELECT * FROM invitations WHERE token = ?').get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });
  if (inv.status !== 'pending' || new Date(inv.expires_at) < new Date())
    return res.status(410).json({ error: 'Invitation is no longer valid' });

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 10);

  const accept = db.transaction(() => {
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username.trim(), hash, 'engineer');
    const userId = result.lastInsertRowid;

    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(inv.project_id, userId);
    db.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ?`).run(inv.id);

    // Welcome notification
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(inv.project_id);
    createNotification(userId, 'assignment', 'Welcome to Kuma!',
      `You've joined "${project.name}". Get started by checking your tasks.`, `/projects/${inv.project_id}`);

    return db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
  });

  const user = accept();

  // Auto-login
  req.session.userId = user.id;
  req.session.role = user.role;

  res.status(201).json(user);
});

// GET /api/projects/:id/invitations — list pending invites for a project (admin)
app.get('/api/projects/:id/invitations', requireAdmin, (req, res) => {
  const projectId = parseInt(req.params.id);
  const invites = db.prepare(`
    SELECT i.id, i.email, i.status, i.created_at, i.expires_at, u.username as invited_by_name
    FROM invitations i JOIN users u ON u.id = i.invited_by
    WHERE i.project_id = ? ORDER BY i.created_at DESC LIMIT 20
  `).all(projectId);
  res.json(invites);
});

// DELETE /api/projects/:id/invitations/:invId — cancel a pending invite (admin)
app.delete('/api/projects/:id/invitations/:invId', requireAdmin, (req, res) => {
  const result = db.prepare(`UPDATE invitations SET status = 'expired' WHERE id = ? AND project_id = ? AND status = 'pending'`)
    .run(parseInt(req.params.invId), parseInt(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Invitation not found or already used' });
  res.json({ message: 'Invitation cancelled' });
});

// ─── Chat Routes ──────────────────────────────────────────────────────────────

// GET /api/users — list all users for starting conversations
app.get('/api/users', requireAuth, (_req, res) => {
  const users = db.prepare(
    'SELECT id, username, full_name, avatar_color FROM users ORDER BY username ASC'
  ).all();
  res.json(users);
});

// GET /api/conversations — list current user's conversations
app.get('/api/conversations', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const convs = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT type FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_type,
      (SELECT created_at FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT u2.username FROM messages m2 JOIN users u2 ON u2.id = m2.sender_id WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL ORDER BY m2.created_at DESC LIMIT 1) as last_sender,
      (
        SELECT COUNT(*) FROM messages m3
        WHERE m3.conversation_id = c.id
        AND m3.sender_id != ?
        AND m3.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM json_each(m3.read_by) WHERE value = ?)
      ) as unread_count
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `).all(userId, userId, userId);

  for (const conv of convs) {
    conv.members = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.avatar_color
      FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ?
    `).all(conv.id);
  }

  res.json(convs);
});

// POST /api/conversations — create direct or group conversation
app.post('/api/conversations', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { type, name, memberIds } = req.body;

  if (!['direct', 'group'].includes(type)) return res.status(400).json({ error: 'Invalid conversation type' });
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) return res.status(400).json({ error: 'At least one member required' });

  if (type === 'direct') {
    if (memberIds.length !== 1) return res.status(400).json({ error: 'Direct conversation requires one other user' });
    const otherId = parseInt(memberIds[0]);
    const existing = db.prepare(`
      SELECT c.id FROM conversations c
      JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
      WHERE c.type = 'direct' LIMIT 1
    `).get(userId, otherId);
    if (existing) {
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(existing.id);
      conv.members = db.prepare(`SELECT u.id, u.username, u.full_name, u.avatar_color FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`).all(existing.id);
      conv.unread_count = 0; conv.last_message = null; conv.last_message_at = null;
      return res.json(conv);
    }
  }

  if (type === 'group' && (!name || !name.trim())) return res.status(400).json({ error: 'Group name is required' });

  const result = db.prepare('INSERT INTO conversations (type, name, created_by) VALUES (?, ?, ?)').run(type, name?.trim() || null, userId);
  const convId = result.lastInsertRowid;

  const insertMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
  db.transaction(() => {
    insertMember.run(convId, userId);
    for (const mid of memberIds) {
      const id = parseInt(mid);
      if (id && id !== userId) insertMember.run(convId, id);
    }
  })();

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  conv.members = db.prepare(`SELECT u.id, u.username, u.full_name, u.avatar_color FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`).all(convId);
  conv.unread_count = 0; conv.last_message = null; conv.last_message_at = null;
  res.status(201).json(conv);
});

// GET /api/conversations/:id/messages — paginated messages (30 per page)
app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const convId = parseInt(req.params.id);
  const userId = req.session.userId;
  const before = req.query.before ? parseInt(req.query.before) : null;

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!member) return res.status(403).json({ error: 'Access denied' });

  const rows = before
    ? db.prepare(`SELECT m.*, u.username, u.full_name, u.avatar_color FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.created_at DESC LIMIT 30`).all(convId, before)
    : db.prepare(`SELECT m.*, u.username, u.full_name, u.avatar_color FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT 30`).all(convId);

  res.json(rows.reverse());
});

// POST /api/conversations/:id/messages — send text message
app.post('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const convId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { content } = req.body;

  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
  if (content.trim().length > MAX_COMMENT_LEN) return res.status(400).json({ error: 'Message too long' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!member) return res.status(403).json({ error: 'Access denied' });

  const result = db.prepare(
    `INSERT INTO messages (conversation_id, sender_id, content, type, read_by) VALUES (?, ?, ?, 'text', json_array(?))`
  ).run(convId, userId, content.trim(), userId);

  const msg = db.prepare(`SELECT m.*, u.username, u.full_name, u.avatar_color FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(msg);
});

// POST /api/conversations/:id/messages/upload — send voice/file message
app.post('/api/conversations/:id/messages/upload', requireAuth, upload.single('file'), (req, res) => {
  const convId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { type, duration } = req.body;

  if (!req.file) return res.status(400).json({ error: 'File is required' });
  if (!['voice', 'file'].includes(type)) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: 'Invalid type' }); }

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!member) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ error: 'Access denied' }); }

  if (type === 'voice') {
    const voiceMimes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    if (!voiceMimes.includes(req.file.mimetype)) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: 'Invalid audio format' }); }
  }

  const result = db.prepare(
    `INSERT INTO messages (conversation_id, sender_id, content, type, file_path, file_name, file_size, duration, read_by) VALUES (?, ?, '', ?, ?, ?, ?, ?, json_array(?))`
  ).run(convId, userId, type, req.file.filename, req.file.originalname, req.file.size, duration ? parseInt(duration) : null, userId);

  const msg = db.prepare(`SELECT m.*, u.username, u.full_name, u.avatar_color FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(msg);
});

// POST /api/conversations/:id/read — mark all messages as read
app.post('/api/conversations/:id/read', requireAuth, (req, res) => {
  const convId = parseInt(req.params.id);
  const userId = req.session.userId;

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!member) return res.status(403).json({ error: 'Access denied' });

  db.prepare(`
    UPDATE messages SET read_by = json_insert(read_by, '$[#]', ?)
    WHERE conversation_id = ? AND sender_id != ? AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM json_each(messages.read_by) WHERE value = ?)
  `).run(userId, convId, userId, userId);

  res.json({ ok: true });
});

// DELETE /api/messages/:id — soft delete own message
app.delete('/api/messages/:id', requireAuth, (req, res) => {
  const msgId = parseInt(req.params.id);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
  if (!msg || msg.deleted_at) return res.status(404).json({ error: 'Message not found' });
  if (req.session.role !== 'admin' && msg.sender_id !== req.session.userId) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(msgId);
  res.status(204).end();
});

// POST /api/conversations/:id/members — add member to group
app.post('/api/conversations/:id/members', requireAuth, (req, res) => {
  const convId = parseInt(req.params.id);
  const { userId: newMemberId } = req.body;
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (conv.type !== 'group') return res.status(400).json({ error: 'Can only add members to groups' });
  if (req.session.role !== 'admin' && conv.created_by !== req.session.userId) return res.status(403).json({ error: 'Only the group creator can add members' });
  try {
    db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(convId, parseInt(newMemberId));
    res.status(201).json({ ok: true });
  } catch {
    res.status(409).json({ error: 'User is already a member' });
  }
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  const nameErr = validateName(username, 'Username');
  if (nameErr) return res.status(400).json({ error: nameErr });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['admin', 'engineer'].includes(role)) return res.status(400).json({ error: 'Role must be admin or engineer' });

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = require('bcrypt').hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username.trim(), hash, role);

  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// ─── Health Route ────────────────────────────────────────────────────────────

app.get('/api/health', requireAuth, (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({
      status: 'ok',
      db: 'connected',
      users: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ─── Static Files (after API routes so POST /api/* isn't blocked) ────────────
const clientDist = path.join(__dirname, 'client', 'dist');
// Hashed asset filenames (JS/CSS) can be cached for 1 year; index.html must never be cached
app.use(express.static(clientDist, {
  maxAge: '1y',
  etag: true,
  setHeaders(res, filePath) {
    // Never cache index.html so the browser always fetches fresh entry point
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
// SPA fallback: serve React index.html for all non-API routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── Global Error Handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
