// ── State ─────────────────────────────────────────────────────────────────────
const projectId = parseInt(window.location.pathname.split('/').pop(), 10);
let project = null;
let tasks = [];
let milestones = [];
let currentTags = [];

const STATUS_LABELS = {
    idea: 'Idea', in_progress: 'In Progress', completed: 'Completed', paused: 'Paused',
};

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function init() {
    if (isNaN(projectId)) return showError('Invalid project URL.');
    try {
        [project, tasks, milestones] = await Promise.all([
            api('GET', `/api/projects/${projectId}`),
            api('GET', `/api/projects/${projectId}/tasks`),
            api('GET', `/api/projects/${projectId}/milestones`),
        ]);
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('pageContent').style.display = 'block';
        renderHero();
        renderTasks();
        renderMilestones();
    } catch (e) {
        showError(e.message);
    }
}

function showError(msg) {
    document.getElementById('loadingState').textContent = `Error: ${msg}`;
}

// ── Render hero ───────────────────────────────────────────────────────────────
function renderHero() {
    document.title = `${project.name} — Project Organizer`;
    document.getElementById('headerProjectName').textContent = project.name;

    const statusEl = document.getElementById('heroStatus');
    statusEl.textContent = STATUS_LABELS[project.status] || project.status;
    statusEl.className = `status-badge status-${project.status}`;

    document.getElementById('heroName').textContent = project.name;

    const descEl = document.getElementById('heroDesc');
    if (project.description) {
        descEl.textContent = project.description;
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    const tagsEl = document.getElementById('heroTags');
    if (project.tags.length > 0) {
        tagsEl.innerHTML = project.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
        tagsEl.style.display = 'flex';
    } else {
        tagsEl.style.display = 'none';
    }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function renderTasks() {
    const done = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const badge = document.getElementById('taskCount');
    badge.textContent = total > 0 ? `${done}/${total}` : '0';
    badge.className = `count-badge${done > 0 && done === total ? ' has-progress' : ''}`;

    const list = document.getElementById('taskList');
    if (total === 0) {
        list.innerHTML = `<li class="section-empty">No tasks yet.<br>Add one to start tracking your work.</li>`;
        return;
    }
    list.innerHTML = tasks.map(taskHTML).join('');
}

function taskHTML(t) {
    const checkSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    return `
    <li class="item-row${t.completed ? ' item-done' : ''}" data-id="${t.id}">
        <button class="check-btn${t.completed ? ' checked' : ''}" data-action="toggle-task" data-id="${t.id}" title="${t.completed ? 'Mark incomplete' : 'Mark complete'}">
            ${checkSVG}
        </button>
        <div class="item-content">
            <span class="item-title">${esc(t.title)}</span>
            ${t.notes ? `<span class="item-sub">${esc(t.notes)}</span>` : ''}
        </div>
        <button class="icon-btn delete item-delete" data-action="delete-task" data-id="${t.id}" title="Delete task">
            ${trashSVG()}
        </button>
    </li>`;
}

async function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    const updated = await api('PATCH', `/api/tasks/${id}`, { completed: !t.completed });
    tasks = tasks.map(t => t.id === id ? updated : t);
    renderTasks();
}

async function deleteTask(id) {
    await api('DELETE', `/api/tasks/${id}`);
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
}

async function addTask() {
    const title = document.getElementById('taskTitleInput').value.trim();
    if (!title) { document.getElementById('taskTitleInput').focus(); return; }
    const notes = document.getElementById('taskNotesInput').value.trim();
    const btn = document.getElementById('saveTaskBtn');
    btn.disabled = true;
    try {
        const created = await api('POST', `/api/projects/${projectId}/tasks`, { title, notes: notes || null });
        tasks.push(created);
        renderTasks();
        hideAddForm('task');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

// ── Milestones ────────────────────────────────────────────────────────────────
function renderMilestones() {
    const done = milestones.filter(m => m.completed).length;
    const total = milestones.length;
    const badge = document.getElementById('milestoneCount');
    badge.textContent = total > 0 ? `${done}/${total}` : '0';
    badge.className = `count-badge${done > 0 && done === total ? ' has-progress' : ''}`;

    const list = document.getElementById('milestoneList');
    if (total === 0) {
        list.innerHTML = `<li class="section-empty">No milestones yet.<br>Add one to mark key goals.</li>`;
        return;
    }
    list.innerHTML = milestones.map(milestoneHTML).join('');
}

function milestoneHTML(m) {
    const flagFilled = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    const flagOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    return `
    <li class="item-row${m.completed ? ' item-done' : ''}" data-id="${m.id}">
        <button class="milestone-btn${m.completed ? ' checked' : ''}" data-action="toggle-milestone" data-id="${m.id}" title="${m.completed ? 'Mark incomplete' : 'Mark complete'}">
            ${m.completed ? flagFilled : flagOutline}
        </button>
        <div class="item-content">
            <span class="item-title">${esc(m.title)}</span>
            ${m.description ? `<span class="item-sub">${esc(m.description)}</span>` : ''}
        </div>
        <button class="icon-btn delete item-delete" data-action="delete-milestone" data-id="${m.id}" title="Delete milestone">
            ${trashSVG()}
        </button>
    </li>`;
}

async function toggleMilestone(id) {
    const m = milestones.find(m => m.id === id);
    if (!m) return;
    const updated = await api('PATCH', `/api/milestones/${id}`, { completed: !m.completed });
    milestones = milestones.map(m => m.id === id ? updated : m);
    renderMilestones();
}

async function deleteMilestone(id) {
    await api('DELETE', `/api/milestones/${id}`);
    milestones = milestones.filter(m => m.id !== id);
    renderMilestones();
}

async function addMilestone() {
    const title = document.getElementById('milestoneTitleInput').value.trim();
    if (!title) { document.getElementById('milestoneTitleInput').focus(); return; }
    const description = document.getElementById('milestoneDescInput').value.trim();
    const btn = document.getElementById('saveMilestoneBtn');
    btn.disabled = true;
    try {
        const created = await api('POST', `/api/projects/${projectId}/milestones`, {
            title, description: description || null,
        });
        milestones.push(created);
        renderMilestones();
        hideAddForm('milestone');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

// ── Add forms ─────────────────────────────────────────────────────────────────
function showAddForm(type) {
    const form = document.getElementById(`add${cap(type)}Form`);
    form.classList.remove('hidden');
    form.querySelector('input[type="text"]').focus();
}

function hideAddForm(type) {
    const form = document.getElementById(`add${cap(type)}Form`);
    form.classList.add('hidden');
    form.querySelectorAll('input, textarea').forEach(el => el.value = '');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Edit project modal ────────────────────────────────────────────────────────
function openEditModal() {
    currentTags = [...project.tags];
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectStatus').value = project.status;
    renderTagChips();
    setActive('modal', 'modalOverlay', true);
    setTimeout(() => document.getElementById('projectName').focus(), 50);
}

function closeEditModal() {
    setActive('modal', 'modalOverlay', false);
    document.getElementById('projectName').classList.remove('input-error');
    document.getElementById('nameError').classList.remove('visible');
}

async function saveEdit() {
    const nameInput = document.getElementById('projectName');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.classList.add('input-error');
        document.getElementById('nameError').classList.add('visible');
        nameInput.focus();
        return;
    }
    nameInput.classList.remove('input-error');
    document.getElementById('nameError').classList.remove('visible');

    const btn = document.getElementById('saveEditBtn');
    btn.disabled = true;
    try {
        project = await api('PUT', `/api/projects/${projectId}`, {
            name,
            description: document.getElementById('projectDescription').value.trim() || null,
            status: document.getElementById('projectStatus').value,
            tags: [...currentTags],
        });
        closeEditModal();
        renderHero();
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

// ── Delete project ────────────────────────────────────────────────────────────
function openDeleteModal() {
    document.getElementById('deleteProjectName').textContent = project?.name || '';
    setActive('deleteModal', 'deleteOverlay', true);
}

function closeDeleteModal() {
    setActive('deleteModal', 'deleteOverlay', false);
}

async function confirmDelete() {
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try {
        await api('DELETE', `/api/projects/${projectId}`);
        window.location.href = '/';
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
    }
}

// ── Tag input ─────────────────────────────────────────────────────────────────
function addTag(raw) {
    const tag = raw.replace(/,/g, '').trim();
    if (!tag || currentTags.includes(tag)) return;
    currentTags.push(tag);
    renderTagChips();
}

function removeTag(index) {
    currentTags.splice(index, 1);
    renderTagChips();
}

function renderTagChips() {
    const container = document.getElementById('tagInputContainer');
    const input = document.getElementById('tagInput');
    container.querySelectorAll('.tag-chip').forEach(c => c.remove());
    currentTags.forEach((tag, i) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${esc(tag)}<button class="tag-chip-remove" type="button" data-index="${i}">&#x2715;</button>`;
        container.insertBefore(chip, input);
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setActive(modalId, overlayId, active) {
    document.getElementById(modalId).classList.toggle('active', active);
    document.getElementById(overlayId).classList.toggle('active', active);
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function trashSVG() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
    </svg>`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Header buttons
    document.getElementById('editProjectBtn').addEventListener('click', openEditModal);
    document.getElementById('deleteProjectBtn').addEventListener('click', openDeleteModal);

    // Task form
    document.getElementById('addTaskBtn').addEventListener('click', () => showAddForm('task'));
    document.getElementById('cancelTaskBtn').addEventListener('click', () => hideAddForm('task'));
    document.getElementById('saveTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskTitleInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addTask();
        if (e.key === 'Escape') hideAddForm('task');
    });

    // Milestone form
    document.getElementById('addMilestoneBtn').addEventListener('click', () => showAddForm('milestone'));
    document.getElementById('cancelMilestoneBtn').addEventListener('click', () => hideAddForm('milestone'));
    document.getElementById('saveMilestoneBtn').addEventListener('click', addMilestone);
    document.getElementById('milestoneTitleInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addMilestone();
        if (e.key === 'Escape') hideAddForm('milestone');
    });

    // Task & milestone list clicks via delegation
    document.getElementById('taskList').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (btn.dataset.action === 'toggle-task') toggleTask(id);
        else if (btn.dataset.action === 'delete-task') deleteTask(id);
    });

    document.getElementById('milestoneList').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (btn.dataset.action === 'toggle-milestone') toggleMilestone(id);
        else if (btn.dataset.action === 'delete-milestone') deleteMilestone(id);
    });

    // Edit modal
    document.getElementById('modalCloseBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('modalOverlay').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('projectName').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveEdit();
    });

    // Delete modal
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteOverlay').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Tag input
    const tagInput = document.getElementById('tagInput');
    tagInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagInput.value);
            tagInput.value = '';
        } else if (e.key === 'Backspace' && tagInput.value === '' && currentTags.length > 0) {
            removeTag(currentTags.length - 1);
        }
    });
    tagInput.addEventListener('blur', () => {
        if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; }
    });
    document.getElementById('tagInputContainer').addEventListener('click', e => {
        if (e.target.classList.contains('tag-chip-remove')) {
            removeTag(parseInt(e.target.dataset.index, 10));
            return;
        }
        tagInput.focus();
    });

    // Global Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeEditModal(); closeDeleteModal(); }
    });
});
