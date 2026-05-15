// ── State ─────────────────────────────────────────────────────────────────────
const projectId = parseInt(window.location.pathname.split('/').pop(), 10);
let project = null;
let tasks = [];
let milestones = [];
let currentTags = [];
let activePriorityTarget = null;

const STATUS_LABELS = {
    idea: 'Idea', in_progress: 'In Progress', completed: 'Completed', paused: 'Paused',
};
const PRIORITY_SHORT = { high: 'High', medium: 'Med', low: 'Low', none: '—' };

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

// ── Init ──────────────────────────────────────────────────────────────────────
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
        setupDrag('taskList', 'task');
        setupDrag('milestoneList', 'milestone');
    } catch (e) {
        showError(e.message);
    }
}

function showError(msg) {
    document.getElementById('loadingState').textContent = `Error: ${msg}`;
}

// ── Hero ──────────────────────────────────────────────────────────────────────
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

    const githubBtn = document.getElementById('githubBtn');
    const url = project.github_url;
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        githubBtn.href = url;
        githubBtn.style.display = '';
    } else {
        githubBtn.style.display = 'none';
    }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function renderTasks() {
    const done  = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const badge = document.getElementById('taskCount');
    badge.textContent = total > 0 ? `${done}/${total}` : '0';
    badge.className   = `count-badge${done > 0 && done === total ? ' has-progress' : ''}`;

    const list = document.getElementById('taskList');
    if (total === 0) {
        list.innerHTML = `<li class="section-empty">No tasks yet.<br>Add one to start tracking your work.</li>`;
        return;
    }
    list.innerHTML = tasks.map(taskHTML).join('');
}

function taskHTML(t) {
    const p = t.priority || 'none';
    return `
    <li class="item-row${t.completed ? ' item-done' : ''}" data-id="${t.id}" data-priority="${p}" draggable="true">
        <span class="drag-handle">${dragHandleSVG()}</span>
        <button class="check-btn${t.completed ? ' checked' : ''}" data-action="toggle-task" data-id="${t.id}">
            ${checkSVG()}
        </button>
        <button class="priority-badge p-${p}" data-action="open-priority" data-id="${t.id}" data-kind="task">
            ${PRIORITY_SHORT[p]}
        </button>
        <div class="item-content">
            <span class="item-title">${esc(t.title)}</span>
            ${t.notes ? `<span class="item-sub">${esc(t.notes)}</span>` : ''}
        </div>
        <button class="icon-btn delete item-delete" data-action="delete-task" data-id="${t.id}">${trashSVG()}</button>
    </li>`;
}

async function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    const updated = await api('PATCH', `/api/tasks/${id}`, { completed: !t.completed });
    tasks = tasks.map(x => x.id === id ? updated : x);
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
        const created = await api('POST', `/api/projects/${projectId}/tasks`,
            { title, notes: notes || null });
        tasks.push(created);
        renderTasks();
        hideAddForm('task');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

async function saveTaskOrder() {
    await api('PUT', `/api/projects/${projectId}/tasks/reorder`, { ids: tasks.map(t => t.id) });
}

// ── Milestones ────────────────────────────────────────────────────────────────
function renderMilestones() {
    const done  = milestones.filter(m => m.completed).length;
    const total = milestones.length;
    const badge = document.getElementById('milestoneCount');
    badge.textContent = total > 0 ? `${done}/${total}` : '0';
    badge.className   = `count-badge${done > 0 && done === total ? ' has-progress' : ''}`;

    const list = document.getElementById('milestoneList');
    if (total === 0) {
        list.innerHTML = `<li class="section-empty">No milestones yet.<br>Add one to mark key goals.</li>`;
        return;
    }
    list.innerHTML = milestones.map(milestoneHTML).join('');
}

function milestoneHTML(m) {
    const p = m.priority || 'none';
    const flagFilled  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    const flagOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    return `
    <li class="item-row${m.completed ? ' item-done' : ''}" data-id="${m.id}" data-priority="${p}" draggable="true">
        <span class="drag-handle">${dragHandleSVG()}</span>
        <button class="milestone-btn${m.completed ? ' checked' : ''}" data-action="toggle-milestone" data-id="${m.id}">
            ${m.completed ? flagFilled : flagOutline}
        </button>
        <button class="priority-badge p-${p}" data-action="open-priority" data-id="${m.id}" data-kind="milestone">
            ${PRIORITY_SHORT[p]}
        </button>
        <div class="item-content">
            <span class="item-title">${esc(m.title)}</span>
            ${m.description ? `<span class="item-sub">${esc(m.description)}</span>` : ''}
        </div>
        <button class="icon-btn delete item-delete" data-action="delete-milestone" data-id="${m.id}">${trashSVG()}</button>
    </li>`;
}

async function toggleMilestone(id) {
    const m = milestones.find(m => m.id === id);
    if (!m) return;
    const updated = await api('PATCH', `/api/milestones/${id}`, { completed: !m.completed });
    milestones = milestones.map(x => x.id === id ? updated : x);
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
        const created = await api('POST', `/api/projects/${projectId}/milestones`,
            { title, description: description || null });
        milestones.push(created);
        renderMilestones();
        hideAddForm('milestone');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

async function saveMilestoneOrder() {
    await api('PUT', `/api/projects/${projectId}/milestones/reorder`, { ids: milestones.map(m => m.id) });
}

// ── Priority dropdown ─────────────────────────────────────────────────────────
function openPriorityDropdown(btn, id, kind) {
    activePriorityTarget = { id, kind };
    const dropdown = document.getElementById('priorityDropdown');
    const rect = btn.getBoundingClientRect();
    dropdown.style.display = 'block';
    dropdown.style.top  = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    requestAnimationFrame(() => {
        const dr = dropdown.getBoundingClientRect();
        if (dr.right > window.innerWidth - 8)
            dropdown.style.left = (window.innerWidth - 8 - dr.width) + 'px';
    });
}

function closePriorityDropdown() {
    document.getElementById('priorityDropdown').style.display = 'none';
    activePriorityTarget = null;
}

async function setPriority(priority) {
    if (!activePriorityTarget) return;
    const { id, kind } = activePriorityTarget;
    closePriorityDropdown();

    if (kind === 'task') {
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        tasks[idx] = { ...tasks[idx], priority };
        renderTasks();
        try {
            await api('PATCH', `/api/tasks/${id}`, { priority });
        } catch (e) {
            alert(e.message);
            tasks = await api('GET', `/api/projects/${projectId}/tasks`);
            renderTasks();
        }
    } else {
        const idx = milestones.findIndex(m => m.id === id);
        if (idx === -1) return;
        milestones[idx] = { ...milestones[idx], priority };
        renderMilestones();
        try {
            await api('PATCH', `/api/milestones/${id}`, { priority });
        } catch (e) {
            alert(e.message);
            milestones = await api('GET', `/api/projects/${projectId}/milestones`);
            renderMilestones();
        }
    }
}

// ── Drag and drop ─────────────────────────────────────────────────────────────
function setupDrag(listId, type) {
    const list = document.getElementById(listId);
    let dragId = null;

    list.addEventListener('dragstart', e => {
        const row = e.target.closest('.item-row');
        if (!row) return;
        dragId = parseInt(row.dataset.id, 10);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => row.classList.add('dragging'), 0);
    });

    list.addEventListener('dragend', () => {
        list.querySelectorAll('.dragging, .drag-above, .drag-below')
            .forEach(el => el.classList.remove('dragging', 'drag-above', 'drag-below'));
        dragId = null;
    });

    list.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.drag-above, .drag-below')
            .forEach(el => el.classList.remove('drag-above', 'drag-below'));
        const row = e.target.closest('.item-row');
        if (row && parseInt(row.dataset.id) !== dragId) {
            const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
            row.classList.add(e.clientY < mid ? 'drag-above' : 'drag-below');
        }
    });

    list.addEventListener('drop', e => {
        e.preventDefault();
        if (dragId === null) return;

        const arr = type === 'task' ? tasks : milestones;
        const srcIdx = arr.findIndex(x => x.id === dragId);
        if (srcIdx === -1) return;
        const src = { ...arr[srcIdx] };

        const row = e.target.closest('.item-row');
        arr.splice(srcIdx, 1);

        if (row) {
            const targetId = parseInt(row.dataset.id);
            const tgtIdx   = arr.findIndex(x => x.id === targetId);
            const rect     = row.getBoundingClientRect();
            const after    = e.clientY >= rect.top + rect.height / 2;
            arr.splice(after ? tgtIdx + 1 : tgtIdx, 0, src);
        } else {
            arr.push(src);
        }

        if (type === 'task') tasks = arr;
        else milestones = arr;

        type === 'task' ? renderTasks() : renderMilestones();
        (type === 'task' ? saveTaskOrder : saveMilestoneOrder)().catch(err => alert(err.message));
    });
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
    document.getElementById('projectGithubUrl').value = project.github_url || '';
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
            github_url: document.getElementById('projectGithubUrl').value.trim() || null,
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

function closeDeleteModal() { setActive('deleteModal', 'deleteOverlay', false); }

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

function removeTag(index) { currentTags.splice(index, 1); renderTagChips(); }

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
function setActive(id1, id2, on) {
    document.getElementById(id1).classList.toggle('active', on);
    document.getElementById(id2).classList.toggle('active', on);
}

function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function checkSVG() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function trashSVG() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
}

function dragHandleSVG() {
    return `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style="color:inherit">
        <circle cx="2.5" cy="2.5" r="1.4"/><circle cx="7.5" cy="2.5" r="1.4"/>
        <circle cx="2.5" cy="7"   r="1.4"/><circle cx="7.5" cy="7"   r="1.4"/>
        <circle cx="2.5" cy="11.5" r="1.4"/><circle cx="7.5" cy="11.5" r="1.4"/>
    </svg>`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('editProjectBtn').addEventListener('click', openEditModal);

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

    // Task list delegation
    document.getElementById('taskList').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (btn.dataset.action === 'toggle-task')   toggleTask(id);
        if (btn.dataset.action === 'delete-task')   deleteTask(id);
        if (btn.dataset.action === 'open-priority') openPriorityDropdown(btn, id, btn.dataset.kind);
    });

    // Milestone list delegation
    document.getElementById('milestoneList').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (btn.dataset.action === 'toggle-milestone') toggleMilestone(id);
        if (btn.dataset.action === 'delete-milestone') deleteMilestone(id);
        if (btn.dataset.action === 'open-priority')    openPriorityDropdown(btn, id, btn.dataset.kind);
    });

    // Priority dropdown
    document.getElementById('priorityDropdown').addEventListener('click', e => {
        const opt = e.target.closest('.priority-option');
        if (opt) setPriority(opt.dataset.priority);
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('#priorityDropdown') && !e.target.closest('[data-action="open-priority"]'))
            closePriorityDropdown();
    });

    // Edit modal
    document.getElementById('modalCloseBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('modalOverlay').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('deleteProjectBtn').addEventListener('click', openDeleteModal);
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
            e.preventDefault(); addTag(tagInput.value); tagInput.value = '';
        } else if (e.key === 'Backspace' && tagInput.value === '' && currentTags.length > 0) {
            removeTag(currentTags.length - 1);
        }
    });
    tagInput.addEventListener('blur', () => {
        if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; }
    });
    document.getElementById('tagInputContainer').addEventListener('click', e => {
        if (e.target.classList.contains('tag-chip-remove')) {
            removeTag(parseInt(e.target.dataset.index, 10)); return;
        }
        tagInput.focus();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeEditModal(); closeDeleteModal(); closePriorityDropdown(); }
    });
});
