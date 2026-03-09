# Kuma — Audio Project Management Tool

A task management tool built for sound engineers. Organise album sessions, mixing workflows, and mastering projects with role-based access control at the task level.

---

## Install & Run

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

Open `http://localhost:3000` in your browser.

The SQLite database (`kuma.db`) is created and seeded automatically on first run.

---

## Default Login Credentials

| Username | Password  | Role     |
|----------|-----------|----------|
| admin    | admin123  | Admin    |
| eng1     | pass123   | Engineer |
| eng2     | pass123   | Engineer |
| eng3     | pass123   | Engineer |

---

## Permission Model

### Roles

| Role     | Capabilities |
|----------|-------------|
| **Admin** | Full access — create/delete projects, task lists, tasks; manage all assignments and exclusions; see all tasks |
| **Engineer** | Read/write access scoped to assigned tasks within projects they're members of |

### Project Membership
Engineers must be added as project members (by an admin) to access a project's task lists.

### Task Permissions

Each task assignment carries one of two permission levels:

| Permission | Can do |
|-----------|--------|
| `edit`    | View task, update status/name/due date, add comments, delete task (if primary assignee) |
| `view`    | View task details only — no edits, no comments |

### Task Exclusions
Admins can explicitly exclude a user from a task even if they are a project member. Excluded users cannot view the task via any API endpoint.

### Primary Assignee
The first user assigned `edit` permission on a task is considered the primary assignee. They can delete that task (admins can always delete any task).

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login with `{ username, password }` |
| POST | `/api/auth/logout` | ✓ | Destroy session |
| GET  | `/api/auth/me` | ✓ | Return current user |

### Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/projects` | ✓ | List projects (admin: all; engineer: assigned only) |
| POST   | `/api/projects` | Admin | Create project `{ name, description? }` |
| GET    | `/api/projects/:id` | ✓ | Project details + members array |
| POST   | `/api/projects/:id/members` | Admin | Add member `{ userId }` |
| DELETE | `/api/projects/:id/members/:userId` | Admin | Remove member |

### Task Lists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/projects/:id/task-lists` | ✓ | List task lists for a project |
| POST | `/api/projects/:id/task-lists` | Admin | Create task list `{ name }` |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/task-lists/:id/tasks` | ✓ | List tasks (filtered by assignment & exclusion for engineers) |
| POST   | `/api/task-lists/:id/tasks` | Admin | Create task `{ name, due_date?, status?, assignees?: [{userId, permission}] }` |
| GET    | `/api/tasks/:id` | ✓ | Task detail + assignments (403 if excluded or not assigned) |
| PUT    | `/api/tasks/:id` | ✓ Edit | Update `{ name?, due_date?, status? }` |
| DELETE | `/api/tasks/:id` | ✓ Primary | Delete task (cascades to comments, assignments, exclusions) |

**Valid status values:** `todo`, `in_progress`, `done`
**Valid date format:** `YYYY-MM-DD`

### Task Assignments (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/tasks/:id/assignments` | Assign user `{ userId, permission }` |
| PUT    | `/api/tasks/:id/assignments/:userId` | Change permission `{ permission }` |
| DELETE | `/api/tasks/:id/assignments/:userId` | Remove assignment |

### Task Exclusions (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/tasks/:id/exclusions` | Exclude user `{ userId }` |
| DELETE | `/api/tasks/:id/exclusions/:userId` | Remove exclusion |

### Comments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/tasks/:id/comments` | ✓ | List comments (403 if excluded) |
| POST | `/api/tasks/:id/comments` | ✓ Edit | Add comment `{ content }` (edit permission required) |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | DB status, user count, timestamp |

---

## Validation Rules

| Field | Rule |
|-------|------|
| Name fields | Required, max 200 characters, trimmed |
| Description | Optional, max 2000 characters |
| Comment content | Required, max 5000 characters |
| `due_date` | Optional, must match `YYYY-MM-DD` format |
| `status` | Must be `todo`, `in_progress`, or `done` |
| `permission` | Must be `edit` or `view` |

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** SQLite via `better-sqlite3`
- **Auth:** `express-session` + `bcrypt`
- **Frontend:** Vanilla JS SPA (no framework)
