/* ─── State ──────────────────────────────────────────────────────────────── */
const state = {
  currentUser:    null,
  currentProject: null,
  currentTask:    null,
  allUsers:       [],
  view:           null,
};

/* ─── DOM Builder (no innerHTML for user content) ────────────────────────── */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      node.className = v;
    } else if (k === 'for') {
      node.htmlFor = v;
    } else if (k === 'disabled' && v === true) {
      node.disabled = true;
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  }
  return node;
}

/* ─── API Layer ──────────────────────────────────────────────────────────── */
async function api(method, path, body = null) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    state.currentUser = null;
    state.allUsers = [];
    showToast('Session expired — please log in again.', 'error');
    navigate('login');
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = el('div', { class: `toast toast--${type}` }, message);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function setLoading(btn, isLoading, label = 'Loading...') {
  if (isLoading) {
    btn._prevText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '';
    btn.appendChild(el('span', { class: 'spinner' }));
    btn.appendChild(document.createTextNode(' ' + label));
  } else {
    btn.disabled = false;
    btn.innerHTML = '';
    btn.appendChild(document.createTextNode(btn._prevText || label));
  }
}

function statusBadge(status) {
  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  const cls = { todo: 'badge--todo', in_progress: 'badge--in-progress', done: 'badge--done' };
  return el('span', { class: `badge ${cls[status] || 'badge--todo'}` }, labels[status] || status);
}

function permBadge(permission) {
  return el('span', { class: `badge badge--${permission}` }, permission);
}

function roleBadge(role) {
  return el('span', { class: `badge badge--${role}` }, role);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(username) {
  if (!username) return '?';
  return username.slice(0, 2).toUpperCase();
}

function isAdmin() {
  return state.currentUser?.role === 'admin';
}

function getUserPermission(task) {
  if (!task?.assignments || !state.currentUser) return null;
  const a = task.assignments.find(a => a.id === state.currentUser.id);
  return a ? a.permission : null;
}

function canEdit(task) {
  return isAdmin() || getUserPermission(task) === 'edit';
}

function isPrimaryAssignee(task) {
  if (!task?.assignments || !state.currentUser) return false;
  const editAssignees = task.assignments.filter(a => a.permission === 'edit');
  return editAssignees.length > 0 && editAssignees[0].id === state.currentUser.id;
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = task.due_date.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  return due < today;
}

function isDueSoon(task) {
  if (!task.due_date || task.status === 'done' || isOverdue(task)) return false;
  const now = new Date();
  const [y, m, d] = task.due_date.split('-').map(Number);
  const due = new Date(y, m - 1, d, 23, 59, 59);
  const diffMs = due - now;
  return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 30)  return 'just now';
  if (diffSec < 90)  return '1 minute ago';
  if (diffMin < 60)  return `${diffMin} minutes ago`;
  if (diffHr  < 2)   return '1 hour ago';
  if (diffHr  < 24)  return `${diffHr} hours ago`;
  if (diffDay < 2)   return 'yesterday';
  if (diffDay < 7)   return `${diffDay} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchAllUsers() {
  if (state.allUsers.length > 0) return state.allUsers;
  try {
    const projects = await api('GET', '/api/projects');
    const details = await Promise.all(projects.map(p => api('GET', `/api/projects/${p.id}`)));
    const seen = new Set();
    const users = [];
    for (const proj of details) {
      for (const m of proj.members) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          users.push(m);
        }
      }
    }
    state.allUsers = users;
    return users;
  } catch {
    return [];
  }
}

/* ─── Router ─────────────────────────────────────────────────────────────── */
function navigate(view, params = {}) {
  state.view = view;
  const app = document.getElementById('app');
  app.innerHTML = '';

  if (view === 'login') {
    renderLogin();
  } else if (view === 'dashboard') {
    renderDashboard();
  } else if (view === 'project') {
    renderProjectDetail(params.projectId);
  } else if (view === 'admin') {
    if (!isAdmin()) { navigate('dashboard'); return; }
    renderAdminPanel();
  }
}

/* ─── Shared Header ──────────────────────────────────────────────────────── */
function buildHeader(opts = {}) {
  const rightItems = [];

  if (isAdmin()) {
    rightItems.push(
      el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => navigate('admin'),
      }, 'Admin Panel')
    );
  }

  rightItems.push(
    el('span', { class: 'app-header__user' },
      state.currentUser?.username || '',
      ' · ',
      state.currentUser?.role || ''
    )
  );

  rightItems.push(
    el('button', {
      class: 'btn btn-ghost btn-sm',
      onclick: async () => {
        await api('POST', '/api/auth/logout').catch(() => {});
        state.currentUser = null;
        state.currentProject = null;
        state.currentTask = null;
        state.allUsers = [];
        navigate('login');
      },
    }, 'Logout')
  );

  const logo = el('div', { class: 'app-header__logo' }, 'Ku', el('span', {}, 'ma'));
  const right = el('div', { class: 'app-header__right' }, ...rightItems);
  return el('header', { class: 'app-header' }, logo, right);
}

/* ─── Dialog Helper ──────────────────────────────────────────────────────── */
function openDialog(contentEl) {
  const backdrop = el('div', { class: 'dialog-backdrop' }, contentEl);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  return () => backdrop.remove();
}

/* ─── Sub-renderers ──────────────────────────────────────────────────────── */
function renderProjectCard(project) {
  const card = el('div', { class: 'project-card' },
    el('div', { class: 'project-card__name truncate' }, project.name),
    el('div', { class: 'project-card__desc' }, project.description || 'No description'),
    el('div', { class: 'project-card__meta' }, 'By ', project.created_by_name)
  );
  card.addEventListener('click', () => navigate('project', { projectId: project.id }));
  return card;
}

function renderTaskCard(task) {
  const overdue  = isOverdue(task);
  const dueSoon  = isDueSoon(task);
  const classes  = 'task-card' + (overdue ? ' task-card--overdue' : '') + (dueSoon ? ' task-card--due-soon' : '');

  const rightChildren = [statusBadge(task.status)];
  if (dueSoon) {
    rightChildren.push(el('span', { class: 'badge badge--warning' }, '⚠ Due soon'));
  }
  if (task.due_date) {
    rightChildren.push(el('span', { class: 'task-card__due' }, formatDate(task.due_date)));
  }

  const right = el('div', { class: 'task-card__right' }, ...rightChildren);
  const card  = el('div', { class: classes, 'data-task-id': task.id },
    el('div', { class: 'task-card__name' }, task.name),
    right
  );
  card.addEventListener('click', () => renderTaskModal(task.id));
  return card;
}

function renderTaskListSection(list, tasks, projectId) {
  const taskEls = tasks.map(t => renderTaskCard(t));

  const sectionRight = [];
  if (isAdmin()) {
    sectionRight.push(
      el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          const close = openDialog(buildCreateTaskForm(list.id, async () => {
            close();
            showToast('Task created');
            await renderProjectDetail(projectId);
          }));
        },
      }, '+ Add Task')
    );
  }

  const header = el('div', { class: 'section-header' },
    el('span', { class: 'section-title' }, list.name),
    el('div', { class: 'flex gap-sm' }, ...sectionRight)
  );

  const taskList = el('div', { class: 'task-list' },
    ...(taskEls.length > 0
      ? taskEls
      : [el('p', { class: 'text-muted text-sm mt-sm' }, 'No tasks yet.')])
  );

  return el('div', { class: 'task-section' }, header, taskList);
}

function renderMemberRow(member, onRemove) {
  const actions = [];
  if (isAdmin() && onRemove) {
    const removeBtn = el('button', { class: 'btn btn-danger btn-sm' }, 'Remove');
    removeBtn.addEventListener('click', () => onRemove(member));
    actions.push(removeBtn);
  }
  return el('div', { class: 'member-row' },
    el('span', { class: 'member-row__name' }, member.username),
    roleBadge(member.role),
    ...actions
  );
}

function renderCommentItem(comment) {
  const fullDate = new Date(comment.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  const timeEl = el('span', { class: 'comment__time', title: fullDate }, relativeTime(comment.created_at));
  return el('div', { class: 'comment' },
    el('div', { class: 'comment__header' },
      el('span', { class: 'comment__author' }, comment.username),
      timeEl
    ),
    el('div', { class: 'comment__body' }, comment.content)
  );
}

function renderAssignmentRow(assignment, taskId, onRefresh) {
  const actions = [];
  if (isAdmin()) {
    const permSelect = el('select', { style: 'width:auto;padding:4px 8px;font-size:12px;' },
      el('option', { value: 'edit', ...(assignment.permission === 'edit' ? { selected: true } : {}) }, 'edit'),
      el('option', { value: 'view', ...(assignment.permission === 'view' ? { selected: true } : {}) }, 'view')
    );
    permSelect.addEventListener('change', async () => {
      try {
        await api('PUT', `/api/tasks/${taskId}/assignments/${assignment.id}`, { permission: permSelect.value });
        showToast('Permission updated');
        onRefresh();
      } catch (e) {
        showToast(e.message, 'error');
        permSelect.value = assignment.permission;
      }
    });

    const removeBtn = el('button', { class: 'btn btn-danger btn-sm' }, 'Remove');
    removeBtn.addEventListener('click', async () => {
      try {
        await api('DELETE', `/api/tasks/${taskId}/assignments/${assignment.id}`);
        showToast('Assignment removed');
        onRefresh();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
    actions.push(permSelect, removeBtn);
  } else {
    actions.push(permBadge(assignment.permission));
  }

  return el('div', { class: 'member-row' },
    el('span', { class: 'member-row__name' }, assignment.username),
    ...actions
  );
}

function renderExclusionRow(exclusion, taskId, onRefresh) {
  const removeBtn = el('button', { class: 'btn btn-danger btn-sm' }, 'Remove');
  removeBtn.addEventListener('click', async () => {
    try {
      await api('DELETE', `/api/tasks/${taskId}/exclusions/${exclusion.userId}`);
      showToast('Exclusion removed');
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
  return el('div', { class: 'member-row' },
    el('span', { class: 'member-row__name' }, exclusion.username),
    removeBtn
  );
}

/* ─── Form Builders ──────────────────────────────────────────────────────── */
function buildCreateProjectForm(onSuccess) {
  const nameInput = el('input', { type: 'text', placeholder: 'Project name', autofocus: true });
  const descInput = el('textarea', { placeholder: 'Description (optional)', style: 'height:80px' });
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Create Project');

  const form = el('form', { class: 'dialog' },
    el('div', { class: 'dialog__title' }, 'New Project'),
    el('div', { class: 'flex flex-col gap-md' },
      el('div', { class: 'form-group' },
        el('label', { class: 'form-label' }, 'Name'),
        nameInput
      ),
      el('div', { class: 'form-group' },
        el('label', { class: 'form-label' }, 'Description'),
        descInput
      ),
      errMsg
    ),
    el('div', { class: 'dialog__footer' },
      submitBtn
    )
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!nameInput.value.trim()) { errMsg.textContent = 'Name is required.'; return; }
    setLoading(submitBtn, true, 'Creating...');
    try {
      await api('POST', '/api/projects', {
        name: nameInput.value.trim(),
        description: descInput.value.trim() || null,
      });
      onSuccess();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return form;
}

function buildCreateTaskListForm(projectId, onSuccess) {
  const nameInput = el('input', { type: 'text', placeholder: 'Task list name', autofocus: true });
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Create List');

  const form = el('form', { class: 'dialog' },
    el('div', { class: 'dialog__title' }, 'New Task List'),
    el('div', { class: 'form-group' },
      el('label', { class: 'form-label' }, 'Name'),
      nameInput
    ),
    errMsg,
    el('div', { class: 'dialog__footer' }, submitBtn)
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!nameInput.value.trim()) { errMsg.textContent = 'Name is required.'; return; }
    setLoading(submitBtn, true, 'Creating...');
    try {
      await api('POST', `/api/projects/${projectId}/task-lists`, { name: nameInput.value.trim() });
      onSuccess();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return form;
}

function buildCreateTaskForm(listId, onSuccess) {
  const nameInput = el('input', { type: 'text', placeholder: 'Task name', autofocus: true });
  const dueDateInput = el('input', { type: 'date' });
  const statusSelect = el('select', {},
    el('option', { value: 'todo' }, 'To Do'),
    el('option', { value: 'in_progress' }, 'In Progress'),
    el('option', { value: 'done' }, 'Done')
  );

  // Assignees section
  const assigneesContainer = el('div', { class: 'flex flex-col gap-sm' });
  const assigneeRows = [];

  function addAssigneeRow() {
    const users = state.allUsers;
    if (!users.length) return;

    const userSelect = el('select', {},
      ...users.map(u => el('option', { value: u.id }, `${u.username} (${u.role})`))
    );
    const permSelect = el('select', { style: 'width:auto' },
      el('option', { value: 'edit' }, 'edit'),
      el('option', { value: 'view' }, 'view')
    );
    const removeBtn = el('button', { type: 'button', class: 'btn btn-danger btn-sm' }, '×');
    const row = el('div', { class: 'flex gap-sm' }, userSelect, permSelect, removeBtn);

    const rowData = { userSelect, permSelect, row };
    assigneeRows.push(rowData);
    assigneesContainer.appendChild(row);

    removeBtn.addEventListener('click', () => {
      const idx = assigneeRows.indexOf(rowData);
      if (idx > -1) assigneeRows.splice(idx, 1);
      row.remove();
    });
  }

  const addAssigneeBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, '+ Add Assignee');
  addAssigneeBtn.addEventListener('click', addAssigneeRow);

  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Create Task');

  const noUsersMsg = state.allUsers.length === 0
    ? el('p', { class: 'text-muted text-sm' }, 'No users available to assign.')
    : null;

  const form = el('form', { class: 'dialog' },
    el('div', { class: 'dialog__title' }, 'New Task'),
    el('div', { class: 'flex flex-col gap-md' },
      el('div', { class: 'form-group' },
        el('label', { class: 'form-label' }, 'Task Name'),
        nameInput
      ),
      el('div', { class: 'flex gap-md' },
        el('div', { class: 'form-group w-full' },
          el('label', { class: 'form-label' }, 'Due Date'),
          dueDateInput
        ),
        el('div', { class: 'form-group w-full' },
          el('label', { class: 'form-label' }, 'Status'),
          statusSelect
        )
      ),
      el('div', { class: 'form-group' },
        el('label', { class: 'form-label' }, 'Assignees'),
        noUsersMsg || assigneesContainer,
        noUsersMsg ? el('span', {}) : addAssigneeBtn
      ),
      errMsg
    ),
    el('div', { class: 'dialog__footer' }, submitBtn)
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!nameInput.value.trim()) { errMsg.textContent = 'Task name is required.'; return; }
    setLoading(submitBtn, true, 'Creating...');
    const assignees = assigneeRows.map(r => ({
      userId: parseInt(r.userSelect.value),
      permission: r.permSelect.value,
    }));
    try {
      await api('POST', `/api/task-lists/${listId}/tasks`, {
        name: nameInput.value.trim(),
        due_date: dueDateInput.value || null,
        status: statusSelect.value,
        assignees,
      });
      onSuccess();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return form;
}

function buildAddMemberForm(projectId, onSuccess) {
  const users = state.allUsers;
  if (!users.length) return el('p', { class: 'text-muted text-sm mt-sm' }, 'No users available.');

  const userSelect = el('select', {},
    ...users.map(u => el('option', { value: u.id }, `${u.username} (${u.role})`))
  );
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Add');

  const form = el('form', { class: 'add-row mt-md' },
    el('div', { class: 'form-group' }, userSelect),
    submitBtn
  );

  const wrapper = el('div', {}, errMsg, form);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    setLoading(submitBtn, true, 'Adding...');
    try {
      await api('POST', `/api/projects/${projectId}/members`, { userId: parseInt(userSelect.value) });
      showToast('Member added');
      onSuccess();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return wrapper;
}

function buildAddAssignmentForm(taskId, onRefresh) {
  const users = state.allUsers;
  if (!users.length) return el('p', { class: 'text-muted text-sm mt-sm' }, 'No users available.');

  const userSelect = el('select', {},
    ...users.map(u => el('option', { value: u.id }, u.username))
  );
  const permSelect = el('select', { style: 'width:auto' },
    el('option', { value: 'edit' }, 'edit'),
    el('option', { value: 'view' }, 'view')
  );
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Assign');

  const form = el('form', { class: 'add-row mt-md' },
    el('div', { class: 'form-group' }, userSelect),
    el('div', { style: 'flex-shrink:0' }, permSelect),
    submitBtn
  );

  const wrapper = el('div', {}, errMsg, form);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    setLoading(submitBtn, true, 'Assigning...');
    try {
      await api('POST', `/api/tasks/${taskId}/assignments`, {
        userId: parseInt(userSelect.value),
        permission: permSelect.value,
      });
      showToast('User assigned');
      onRefresh();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return wrapper;
}

function buildAddExclusionForm(taskId, onRefresh) {
  const users = state.allUsers;
  if (!users.length) return el('p', { class: 'text-muted text-sm mt-sm' }, 'No users available.');

  const userSelect = el('select', {},
    ...users.map(u => el('option', { value: u.id }, u.username))
  );
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-danger btn-sm' }, 'Exclude');

  const form = el('form', { class: 'add-row mt-md' },
    el('div', { class: 'form-group' }, userSelect),
    submitBtn
  );

  const wrapper = el('div', {}, errMsg, form);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    setLoading(submitBtn, true, 'Excluding...');
    try {
      await api('POST', `/api/tasks/${taskId}/exclusions`, { userId: parseInt(userSelect.value) });
      showToast('User excluded from task');
      onRefresh();
    } catch (err) {
      errMsg.textContent = err.message;
      setLoading(submitBtn, false);
    }
  });

  return wrapper;
}

/* ─── View: Login ────────────────────────────────────────────────────────── */
function renderLogin() {
  const app = document.getElementById('app');

  const usernameInput = el('input', { type: 'text', placeholder: 'Username', autocomplete: 'username', autofocus: true });
  const passwordInput = el('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const errMsg = el('div', { class: 'error-msg' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary w-full' }, 'Sign In');

  const form = el('form', { class: 'flex flex-col gap-md' },
    el('div', { class: 'form-group' },
      el('label', { class: 'form-label' }, 'Username'),
      usernameInput
    ),
    el('div', { class: 'form-group' },
      el('label', { class: 'form-label' }, 'Password'),
      passwordInput
    ),
    errMsg,
    submitBtn
  );

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errMsg.textContent = '';
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) { errMsg.textContent = 'Please enter username and password.'; return; }

    setLoading(submitBtn, true, 'Signing in...');
    try {
      const user = await api('POST', '/api/auth/login', { username, password });
      state.currentUser = user;
      navigate('dashboard');
    } catch (err) {
      errMsg.textContent = err.message || 'Invalid credentials.';
      setLoading(submitBtn, false);
    }
  });

  const card = el('div', { class: 'login-card' },
    el('div', { class: 'login-logo' }, 'Ku', el('span', {}, 'ma')),
    el('div', { class: 'login-tagline' }, 'Audio Project Management'),
    form
  );

  app.appendChild(el('div', { class: 'login-wrap' }, card));
}

/* ─── View: Dashboard ────────────────────────────────────────────────────── */
async function renderDashboard() {
  const app = document.getElementById('app');
  app.appendChild(buildHeader());

  const page = el('div', { class: 'page' });
  app.appendChild(page);

  const headerRight = [];
  if (isAdmin()) {
    const newProjBtn = el('button', { class: 'btn btn-primary' }, '+ New Project');
    newProjBtn.addEventListener('click', () => {
      const close = openDialog(buildCreateProjectForm(async () => {
        close();
        showToast('Project created');
        navigate('dashboard');
      }));
    });
    headerRight.push(newProjBtn);
  }

  page.appendChild(
    el('div', { class: 'projects-header' },
      el('div', { class: 'projects-title' }, 'Projects'),
      el('div', { class: 'flex gap-sm' }, ...headerRight)
    )
  );

  const grid = el('div', { class: 'project-grid' });
  const loadingEl = el('div', { class: 'loading-state' }, el('span', { class: 'spinner' }), ' Loading...');
  page.appendChild(loadingEl);

  try {
    const projects = await api('GET', '/api/projects');
    loadingEl.remove();

    if (projects.length === 0) {
      const msg = isAdmin()
        ? 'No projects yet. Create your first one!'
        : 'No projects assigned to you yet.';
      page.appendChild(
        el('div', { class: 'empty-state' },
          el('div', { class: 'empty-state__icon' }, '🎚️'),
          el('div', { class: 'empty-state__text' }, msg)
        )
      );
    } else {
      projects.forEach(p => grid.appendChild(renderProjectCard(p)));
      page.appendChild(grid);
    }
  } catch (err) {
    loadingEl.remove();
    page.appendChild(el('div', { class: 'error-msg mt-md' }, err.message));
  }
}

/* ─── View: Project Detail ───────────────────────────────────────────────── */
async function renderProjectDetail(projectId) {
  const app = document.getElementById('app');
  app.appendChild(buildHeader());

  const page = el('div', { class: 'page' });
  app.appendChild(page);

  const loadingEl = el('div', { class: 'loading-state' }, el('span', { class: 'spinner' }), ' Loading project...');
  page.appendChild(loadingEl);

  try {
    const [project, taskLists] = await Promise.all([
      api('GET', `/api/projects/${projectId}`),
      api('GET', `/api/projects/${projectId}/task-lists`),
    ]);
    state.currentProject = project;

    if (isAdmin()) await fetchAllUsers();

    const tasksPerList = await Promise.all(
      taskLists.map(list => api('GET', `/api/task-lists/${list.id}/tasks`))
    );

    loadingEl.remove();

    // Page header
    const pageHeaderRight = [];
    if (isAdmin()) {
      const addListBtn = el('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          const close = openDialog(buildCreateTaskListForm(projectId, async () => {
            close();
            showToast('Task list created');
            navigate('project', { projectId });
          }));
        },
      }, '+ Task List');
      pageHeaderRight.push(addListBtn);
    }

    page.appendChild(
      el('div', { class: 'page-header' },
        el('button', {
          class: 'btn btn-ghost',
          onclick: () => navigate('dashboard'),
        }, '← Back'),
        el('h1', { class: 'page-header__title' }, project.name),
        el('div', { class: 'page-header__right' }, ...pageHeaderRight)
      )
    );

    // Task list sections
    if (taskLists.length === 0) {
      page.appendChild(
        el('div', { class: 'empty-state' },
          el('div', { class: 'empty-state__icon' }, '📋'),
          el('div', { class: 'empty-state__text' },
            isAdmin() ? 'No task lists yet. Add one above.' : 'No task lists in this project.'
          )
        )
      );
    } else {
      taskLists.forEach((list, i) => {
        page.appendChild(renderTaskListSection(list, tasksPerList[i], projectId));
      });
    }

    // Admin: Manage Members
    if (isAdmin()) {
      const membersCard = el('div', { class: 'card mt-lg' });
      page.appendChild(membersCard);
      renderMembersSection(membersCard, project, projectId);
    }

  } catch (err) {
    loadingEl.remove();
    page.appendChild(el('div', { class: 'error-msg mt-md' }, err.message));
  }
}

function renderMembersSection(container, project, projectId) {
  container.innerHTML = '';

  const title = el('div', { class: 'section-title', style: 'margin-bottom:12px' }, 'Project Members');
  container.appendChild(title);

  if (project.members.length === 0) {
    container.appendChild(el('p', { class: 'text-muted text-sm' }, 'No members.'));
  } else {
    project.members.forEach(m => {
      container.appendChild(renderMemberRow(m, async member => {
        try {
          await api('DELETE', `/api/projects/${projectId}/members/${member.id}`);
          showToast('Member removed');
          project.members = project.members.filter(x => x.id !== member.id);
          renderMembersSection(container, project, projectId);
        } catch (e) {
          showToast(e.message, 'error');
        }
      }));
    });
  }

  // Add member form
  container.appendChild(
    el('div', { class: 'section-title mt-md', style: 'margin-bottom:8px' }, 'Add Member')
  );
  container.appendChild(
    buildAddMemberForm(projectId, async () => {
      const updated = await api('GET', `/api/projects/${projectId}`).catch(() => null);
      if (updated) {
        project.members = updated.members;
        renderMembersSection(container, project, projectId);
      }
    })
  );
}

/* ─── View: Task Modal ───────────────────────────────────────────────────── */
async function renderTaskModal(taskId) {
  let task, comments;
  try {
    [task, comments] = await Promise.all([
      api('GET', `/api/tasks/${taskId}`),
      api('GET', `/api/tasks/${taskId}/comments`),
    ]);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  state.currentTask = task;
  if (isAdmin()) await fetchAllUsers();

  const editable = canEdit(task);
  const backdrop = el('div', { class: 'modal-backdrop' });

  function closeModal() {
    backdrop.remove();
  }

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal();
  });

  const modal = el('div', { class: 'modal' });
  backdrop.appendChild(modal);

  const closeBtn = el('button', { class: 'modal__close', title: 'Close' }, '×');
  closeBtn.addEventListener('click', closeModal);
  modal.appendChild(closeBtn);

  modal.appendChild(el('h2', { class: 'modal__title' }, task.name));

  // ── Editable fields ──
  const nameInput = el('input', {
    type: 'text',
    value: task.name,
    ...(editable ? {} : { disabled: true }),
  });

  const dueDateInput = el('input', {
    type: 'date',
    value: task.due_date || '',
    ...(editable ? {} : { disabled: true }),
  });

  const statusSelect = el('select', { ...(editable ? {} : { disabled: true }) },
    el('option', { value: 'todo',        ...(task.status === 'todo'        ? { selected: true } : {}) }, 'To Do'),
    el('option', { value: 'in_progress', ...(task.status === 'in_progress' ? { selected: true } : {}) }, 'In Progress'),
    el('option', { value: 'done',        ...(task.status === 'done'        ? { selected: true } : {}) }, 'Done')
  );

  const fieldsErrMsg = el('div', { class: 'error-msg' });

  const fieldsSection = el('div', { class: 'flex flex-col gap-md' },
    el('div', { class: 'flex gap-md' },
      el('div', { class: 'form-group w-full' },
        el('label', { class: 'form-label' }, 'Task Name'),
        nameInput
      )
    ),
    el('div', { class: 'flex gap-md' },
      el('div', { class: 'form-group w-full' },
        el('label', { class: 'form-label' }, 'Due Date'),
        dueDateInput
      ),
      el('div', { class: 'form-group w-full' },
        el('label', { class: 'form-label' }, 'Status'),
        statusSelect
      )
    ),
    fieldsErrMsg
  );

  // Live status badge in modal header area
  const modalStatusBadge = statusBadge(task.status);
  modalStatusBadge.style.marginBottom = '12px';
  modal.insertBefore(modalStatusBadge, modal.querySelector('.modal__title').nextSibling);

  if (editable) {
    const saveBtn = el('button', { class: 'btn btn-primary', style: 'align-self:flex-start;margin-top:4px' }, 'Save Changes');
    saveBtn.addEventListener('click', async () => {
      const updates = {};
      const newName = nameInput.value.trim();
      if (newName !== task.name) {
        if (!newName) { fieldsErrMsg.textContent = 'Name cannot be empty.'; return; }
        updates.name = newName;
      }
      const newDate = dueDateInput.value || null;
      if (newDate !== (task.due_date || null)) updates.due_date = newDate;
      if (statusSelect.value !== task.status) updates.status = statusSelect.value;

      if (Object.keys(updates).length === 0) {
        fieldsErrMsg.textContent = 'No changes to save.';
        return;
      }

      setLoading(saveBtn, true, 'Saving...');
      try {
        const updated = await api('PUT', `/api/tasks/${taskId}`, updates);
        Object.assign(task, updated);
        state.currentTask = task;
        showToast('Task updated');
        fieldsErrMsg.textContent = '';
        setLoading(saveBtn, false);

        // Update modal header title if name changed
        const titleEl = modal.querySelector('.modal__title');
        if (titleEl) titleEl.textContent = task.name;

        // Update the status badge in the modal header
        const newBadge = statusBadge(task.status);
        newBadge.style.marginBottom = '12px';
        modalStatusBadge.replaceWith(newBadge);

        // Update the task card in the project detail view (behind the modal)
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
          const nameEl = taskCard.querySelector('.task-card__name');
          if (nameEl) nameEl.textContent = task.name;

          const rightEl = taskCard.querySelector('.task-card__right');
          if (rightEl) {
            rightEl.innerHTML = '';
            rightEl.appendChild(statusBadge(task.status));
            if (isDueSoon(task)) {
              rightEl.appendChild(el('span', { class: 'badge badge--warning' }, '⚠ Due soon'));
            }
            if (task.due_date) {
              rightEl.appendChild(el('span', { class: 'task-card__due' }, formatDate(task.due_date)));
            }
          }
          // Update overdue class
          taskCard.classList.toggle('task-card--overdue', isOverdue(task));
          taskCard.classList.toggle('task-card--due-soon', isDueSoon(task));
        }
      } catch (e) {
        fieldsErrMsg.textContent = e.message;
        setLoading(saveBtn, false);
      }
    });
    fieldsSection.appendChild(saveBtn);
  }

  modal.appendChild(fieldsSection);

  // ── Assignments section ──
  const assignmentsSection = el('div', { class: 'modal__section' });
  modal.appendChild(assignmentsSection);

  function refreshAssignments() {
    api('GET', `/api/tasks/${taskId}`).then(updatedTask => {
      state.currentTask = updatedTask;
      task.assignments = updatedTask.assignments;
      renderAssignmentsSection();
    }).catch(() => {});
  }

  function renderAssignmentsSection() {
    assignmentsSection.innerHTML = '';
    assignmentsSection.appendChild(el('div', { class: 'modal__section-title' }, 'Assignees'));

    if (task.assignments.length === 0) {
      assignmentsSection.appendChild(el('p', { class: 'text-muted text-sm' }, 'No assignees.'));
    } else {
      task.assignments.forEach(a => {
        assignmentsSection.appendChild(renderAssignmentRow(a, taskId, refreshAssignments));
      });
    }

    if (isAdmin()) {
      assignmentsSection.appendChild(buildAddAssignmentForm(taskId, refreshAssignments));
    }
  }

  renderAssignmentsSection();

  // ── Exclusions section (admin only) ──
  if (isAdmin()) {
    const exclusionsSection = el('div', { class: 'modal__section' });
    modal.appendChild(exclusionsSection);

    // Local state — no GET /exclusions endpoint exists, so track session changes
    const localExclusions = [];

    function rebuildExcList() {
      exclusionsSection.innerHTML = '';
      exclusionsSection.appendChild(el('div', { class: 'modal__section-title' }, 'Exclusions'));

      if (localExclusions.length === 0) {
        exclusionsSection.appendChild(el('p', { class: 'text-muted text-sm' }, 'No exclusions set this session.'));
      } else {
        localExclusions.forEach(exc => {
          const removeBtn = el('button', { class: 'btn btn-danger btn-sm' }, 'Remove');
          removeBtn.addEventListener('click', async () => {
            try {
              await api('DELETE', `/api/tasks/${taskId}/exclusions/${exc.userId}`);
              showToast('Exclusion removed');
              const idx = localExclusions.findIndex(e => e.userId === exc.userId);
              if (idx > -1) localExclusions.splice(idx, 1);
              rebuildExcList();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
          exclusionsSection.appendChild(el('div', { class: 'member-row' },
            el('span', { class: 'member-row__name' }, exc.username),
            removeBtn
          ));
        });
      }

      const excUsers = state.allUsers;
      if (!excUsers.length) {
        exclusionsSection.appendChild(el('p', { class: 'text-muted text-sm mt-sm' }, 'No users available.'));
        return;
      }

      const excErrMsg = el('div', { class: 'error-msg' });
      const excUserSelect = el('select', {},
        ...excUsers.map(u => el('option', { value: u.id }, u.username))
      );
      const excSubmitBtn = el('button', { class: 'btn btn-danger btn-sm' }, 'Exclude User');
      const excForm = el('form', { class: 'add-row mt-md' },
        el('div', { class: 'form-group' }, excUserSelect),
        excSubmitBtn
      );
      excForm.addEventListener('submit', async e => {
        e.preventDefault();
        setLoading(excSubmitBtn, true, 'Excluding...');
        const userId = parseInt(excUserSelect.value);
        try {
          await api('POST', `/api/tasks/${taskId}/exclusions`, { userId });
          const user = excUsers.find(u => u.id === userId);
          localExclusions.push({ userId, username: user?.username || String(userId) });
          showToast('User excluded from task');
          rebuildExcList();
        } catch (err) {
          excErrMsg.textContent = err.message;
          setLoading(excSubmitBtn, false);
        }
      });

      exclusionsSection.appendChild(excErrMsg);
      exclusionsSection.appendChild(excForm);
    }

    rebuildExcList();
  }

  // ── Comments section ──
  const commentsSection = el('div', { class: 'modal__section' });
  modal.appendChild(commentsSection);
  commentsSection.appendChild(el('div', { class: 'modal__section-title' }, 'Comments'));

  const commentsList = el('div', { class: 'comments-list' });
  commentsSection.appendChild(commentsList);

  if (comments.length === 0) {
    commentsList.appendChild(el('p', { class: 'text-muted text-sm' }, 'No comments yet.'));
  } else {
    comments.forEach(c => commentsList.appendChild(renderCommentItem(c)));
  }

  // Comment input
  if (editable) {
    const commentInput = el('textarea', { placeholder: 'Add a comment... (Enter to submit, Shift+Enter for newline)' });
    const commentErrMsg = el('div', { class: 'error-msg' });
    const commentBtn = el('button', { class: 'btn btn-primary btn-sm', style: 'flex-shrink:0' }, 'Send');

    async function submitComment() {
      const content = commentInput.value.trim();
      if (!content) return;
      setLoading(commentBtn, true, 'Sending...');
      try {
        const comment = await api('POST', `/api/tasks/${taskId}/comments`, { content });
        const wasEmpty = commentsList.querySelector('p');
        if (wasEmpty) wasEmpty.remove();
        commentsList.appendChild(renderCommentItem(comment));
        commentInput.value = '';
        commentInput.style.height = 'auto';
        commentErrMsg.textContent = '';
        setLoading(commentBtn, false);
        commentsList.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        commentErrMsg.textContent = e.message;
        setLoading(commentBtn, false);
      }
    }

    commentInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment();
      }
    });

    commentBtn.addEventListener('click', submitComment);

    commentsSection.appendChild(commentErrMsg);
    commentsSection.appendChild(
      el('div', { class: 'comment-input-row' }, commentInput, commentBtn)
    );
  }

  // ── Delete button ──
  if (isAdmin() || isPrimaryAssignee(task)) {
    const deleteSection = el('div', { class: 'modal__section' });
    modal.appendChild(deleteSection);

    const deleteBtn = el('button', { class: 'btn btn-danger' }, 'Delete Task');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete task "${task.name}"? This cannot be undone.`)) return;
      setLoading(deleteBtn, true, 'Deleting...');
      try {
        await api('DELETE', `/api/tasks/${taskId}`);
        showToast('Task deleted');
        closeModal();
        if (state.currentProject) {
          navigate('project', { projectId: state.currentProject.id });
        }
      } catch (e) {
        showToast(e.message, 'error');
        setLoading(deleteBtn, false);
      }
    });

    deleteSection.appendChild(deleteBtn);
  }

  document.body.appendChild(backdrop);
}

/* ─── View: Admin Panel ──────────────────────────────────────────────────── */
async function renderAdminPanel() {
  if (!isAdmin()) { navigate('dashboard'); return; }

  const app = document.getElementById('app');
  app.appendChild(buildHeader());

  const page = el('div', { class: 'page' });
  app.appendChild(page);

  page.appendChild(
    el('div', { class: 'page-header' },
      el('button', {
        class: 'btn btn-ghost',
        onclick: () => navigate('dashboard'),
      }, '← Back'),
      el('h1', { class: 'page-header__title' }, 'Admin Panel')
    )
  );

  const loadingEl = el('div', { class: 'loading-state' }, el('span', { class: 'spinner' }), ' Loading...');
  page.appendChild(loadingEl);

  try {
    const [users, projects] = await Promise.all([
      fetchAllUsers(),
      api('GET', '/api/projects'),
    ]);

    loadingEl.remove();

    // ── User table ──
    const usersCard = el('div', { class: 'card' });
    page.appendChild(usersCard);
    usersCard.appendChild(el('div', { class: 'section-title', style: 'margin-bottom:12px' }, 'All Users'));

    if (users.length === 0) {
      usersCard.appendChild(el('p', { class: 'text-muted text-sm' }, 'No users found.'));
    } else {
      const thead = el('thead', {},
        el('tr', {},
          el('th', {}, 'ID'),
          el('th', {}, 'Username'),
          el('th', {}, 'Role')
        )
      );
      const tbody = el('tbody', {},
        ...users.map(u =>
          el('tr', {},
            el('td', { class: 'text-muted' }, String(u.id)),
            el('td', {}, u.username),
            el('td', {}, roleBadge(u.role))
          )
        )
      );
      usersCard.appendChild(el('table', { class: 'data-table' }, thead, tbody));
    }

    // ── Project member management ──
    const membersCard = el('div', { class: 'card mt-lg' });
    page.appendChild(membersCard);
    membersCard.appendChild(el('div', { class: 'section-title', style: 'margin-bottom:12px' }, 'Manage Project Members'));

    if (projects.length === 0) {
      membersCard.appendChild(el('p', { class: 'text-muted text-sm' }, 'No projects found.'));
    } else {
      const projectSelect = el('select', {},
        ...projects.map((p, i) => el('option', { value: p.id, ...(i === 0 ? { selected: true } : {}) }, p.name))
      );

      const memberSection = el('div', { class: 'mt-md' });
      membersCard.appendChild(
        el('div', { class: 'form-group', style: 'max-width:320px' },
          el('label', { class: 'form-label' }, 'Project'),
          projectSelect
        )
      );
      membersCard.appendChild(memberSection);

      async function loadProjectMembers(projectId) {
        memberSection.innerHTML = '';
        const loadEl = el('div', { class: 'text-muted text-sm mt-sm' }, 'Loading members...');
        memberSection.appendChild(loadEl);
        try {
          const proj = await api('GET', `/api/projects/${projectId}`);
          loadEl.remove();

          const membersTitle = el('div', { class: 'section-title mt-md', style: 'margin-bottom:8px' }, 'Members');
          memberSection.appendChild(membersTitle);

          if (proj.members.length === 0) {
            memberSection.appendChild(el('p', { class: 'text-muted text-sm' }, 'No members.'));
          } else {
            proj.members.forEach(m => {
              memberSection.appendChild(renderMemberRow(m, async member => {
                try {
                  await api('DELETE', `/api/projects/${projectId}/members/${member.id}`);
                  showToast('Member removed');
                  loadProjectMembers(projectId);
                } catch (e) {
                  showToast(e.message, 'error');
                }
              }));
            });
          }

          memberSection.appendChild(
            el('div', { class: 'section-title mt-md', style: 'margin-bottom:8px' }, 'Add Member')
          );
          memberSection.appendChild(
            buildAddMemberForm(projectId, () => loadProjectMembers(projectId))
          );
        } catch (e) {
          loadEl.textContent = e.message;
        }
      }

      projectSelect.addEventListener('change', () => loadProjectMembers(parseInt(projectSelect.value)));
      loadProjectMembers(parseInt(projects[0].id));
    }

  } catch (err) {
    loadingEl.remove();
    page.appendChild(el('div', { class: 'error-msg mt-md' }, err.message));
  }
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
async function boot() {
  try {
    const user = await api('GET', '/api/auth/me');
    state.currentUser = user;
    navigate('dashboard');
  } catch {
    navigate('login');
  }
}

document.addEventListener('DOMContentLoaded', boot);
