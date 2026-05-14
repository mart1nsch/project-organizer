// ── State ────────────────────────────────────────────────────────────────────
let projects = [];
let activeFilter = '';
let searchQuery = '';
let sortBy = 'newest';
let activeTagFilter = '';

let editingId = null;
let deletingId = null;
let detailId = null;
let currentTags = [];

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

async function loadProjects() {
    try {
        projects = await api('GET', '/api/projects');
        render();
    } catch (e) {
        document.getElementById('projectsGrid').innerHTML =
            `<p style="color:var(--danger);padding:24px">Failed to load projects: ${e.message}</p>`;
    }
}

// ── Render ────────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
    idea: 'Idea',
    in_progress: 'In Progress',
    completed: 'Completed',
    paused: 'Paused',
};

function getFiltered() {
    let list = [...projects];
    if (activeFilter) list = list.filter(p => p.status === activeFilter);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            p.tags.some(t => t.toLowerCase().includes(q))
        );
    }
    if (activeTagFilter) list = list.filter(p => p.tags.includes(activeTagFilter));
    if (sortBy === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

function render() {
    const filtered = getFiltered();
    const grid = document.getElementById('projectsGrid');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('projectCount');

    const n = projects.length;
    count.textContent = `${n} project${n !== 1 ? 's' : ''}`;

    if (projects.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        empty.innerHTML = emptyStateHTML(false);
    } else if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        empty.innerHTML = emptyStateHTML(true);
    } else {
        empty.style.display = 'none';
        grid.innerHTML = filtered.map(cardHTML).join('');
    }
}

function emptyStateHTML(hasProjects) {
    const folderIcon = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`;
    if (hasProjects) {
        return `${folderIcon}<h2>No matching projects</h2><p>Try a different filter or search term.</p>
            <button class="btn btn-secondary" onclick="clearFilters()">Clear filters</button>`;
    }
    return `${folderIcon}<h2>No projects yet</h2><p>Create your first project to get started.</p>
        <button class="btn btn-primary" onclick="openModal()">+ New Project</button>`;
}

function cardHTML(p) {
    const tags = p.tags.map(t => {
        const active = t === activeTagFilter ? ' active-tag' : '';
        return `<span class="tag${active}" data-tag="${esc(t)}">${esc(t)}</span>`;
    }).join('');

    return `
    <div class="card" data-id="${p.id}" data-status="${p.status}">
        <div class="card-header">
            <h2 class="card-title">${esc(p.name)}</h2>
            <div class="card-actions">
                <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Edit">
                    ${editIcon()}
                </button>
                <button class="icon-btn delete" data-action="delete" data-id="${p.id}" title="Delete">
                    ${trashIcon()}
                </button>
            </div>
        </div>
        ${p.description ? `<p class="card-description">${esc(p.description)}</p>` : ''}
        <div class="card-footer">
            <span class="status-badge status-${p.status}">${STATUS_LABELS[p.status] || p.status}</span>
            ${tags ? `<div class="tag-list">${tags}</div>` : ''}
            <span class="card-date">${relativeTime(p.created_at)}</span>
        </div>
    </div>`;
}

function editIcon() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
}

function trashIcon() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
    </svg>`;
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function relativeTime(isoStr) {
    const date = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
    const diff = Date.now() - date.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
}

function formatDate(isoStr) {
    const date = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function clearFilters() {
    activeFilter = '';
    searchQuery = '';
    activeTagFilter = '';
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-status=""]').classList.add('active');
    render();
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function openDetail(id) {
    const p = projects.find(p => p.id === id);
    if (!p) return;
    detailId = id;

    const statusEl = document.getElementById('detailStatus');
    statusEl.textContent = STATUS_LABELS[p.status] || p.status;
    statusEl.className = `status-badge status-${p.status}`;

    document.getElementById('detailTitle').textContent = p.name;

    const descEl = document.getElementById('detailDescription');
    if (p.description) {
        descEl.textContent = p.description;
        descEl.className = 'detail-description';
    } else {
        descEl.textContent = 'No description provided.';
        descEl.className = 'detail-description no-desc';
    }

    const tagsEl = document.getElementById('detailTags');
    tagsEl.innerHTML = p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');

    document.getElementById('detailCreated').textContent = formatDate(p.created_at);
    document.getElementById('detailUpdated').textContent = formatDate(p.updated_at);

    document.getElementById('detailEditBtn').onclick = () => { closeDetail(); openModal(id); };
    document.getElementById('detailDeleteBtn').onclick = () => { closeDetail(); openDeleteModal(id); };
    document.getElementById('detailOpenBtn').href = `/project/${id}`;

    document.getElementById('detailPanel').classList.add('active');
    document.getElementById('detailOverlay').classList.add('active');
}

function closeDetail() {
    document.getElementById('detailPanel').classList.remove('active');
    document.getElementById('detailOverlay').classList.remove('active');
    detailId = null;
}

// ── Modal (create / edit) ─────────────────────────────────────────────────────
function openModal(id) {
    editingId = id || null;
    currentTags = [];

    const nameInput = document.getElementById('projectName');
    const nameError = document.getElementById('nameError');

    nameInput.classList.remove('input-error');
    nameError.classList.remove('visible');

    if (id) {
        const p = projects.find(p => p.id === id);
        if (!p) return;
        document.getElementById('modalTitle').textContent = 'Edit Project';
        document.getElementById('saveProjectBtn').textContent = 'Save Changes';
        nameInput.value = p.name;
        document.getElementById('projectDescription').value = p.description || '';
        document.getElementById('projectStatus').value = p.status;
        currentTags = [...p.tags];
    } else {
        document.getElementById('modalTitle').textContent = 'New Project';
        document.getElementById('saveProjectBtn').textContent = 'Create Project';
        nameInput.value = '';
        document.getElementById('projectDescription').value = '';
        document.getElementById('projectStatus').value = 'idea';
    }

    renderTagChips();
    setModalActive('modal', 'modalOverlay', true);
    setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
    setModalActive('modal', 'modalOverlay', false);
    editingId = null;
}

async function saveProject() {
    const nameInput = document.getElementById('projectName');
    const nameError = document.getElementById('nameError');
    const name = nameInput.value.trim();

    if (!name) {
        nameInput.classList.add('input-error');
        nameError.classList.add('visible');
        nameInput.focus();
        return;
    }

    nameInput.classList.remove('input-error');
    nameError.classList.remove('visible');

    const data = {
        name,
        description: document.getElementById('projectDescription').value.trim() || null,
        status: document.getElementById('projectStatus').value,
        tags: [...currentTags],
    };

    const btn = document.getElementById('saveProjectBtn');
    btn.disabled = true;

    try {
        if (editingId) {
            const updated = await api('PUT', `/api/projects/${editingId}`, data);
            const idx = projects.findIndex(p => p.id === editingId);
            if (idx !== -1) projects[idx] = updated;
        } else {
            const created = await api('POST', '/api/projects', data);
            projects.unshift(created);
        }
        closeModal();
        render();
    } catch (e) {
        alert(`Error: ${e.message}`);
    } finally {
        btn.disabled = false;
    }
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    const p = projects.find(p => p.id === id);
    document.getElementById('deleteProjectName').textContent = p?.name || '';
    setModalActive('deleteModal', 'deleteOverlay', true);
}

function closeDeleteModal() {
    setModalActive('deleteModal', 'deleteOverlay', false);
    deletingId = null;
}

async function confirmDelete() {
    if (!deletingId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try {
        await api('DELETE', `/api/projects/${deletingId}`);
        projects = projects.filter(p => p.id !== deletingId);
        closeDeleteModal();
        render();
    } catch (e) {
        alert(`Error: ${e.message}`);
        btn.disabled = false;
    }
}

function setModalActive(modalId, overlayId, active) {
    document.getElementById(modalId).classList.toggle('active', active);
    document.getElementById(overlayId).classList.toggle('active', active);
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

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();

    // Header
    document.getElementById('newProjectBtn').addEventListener('click', () => openModal());

    // Toolbar filters
    document.getElementById('statusFilters').addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.status;
        render();
    });

    document.getElementById('searchInput').addEventListener('input', e => {
        searchQuery = e.target.value;
        render();
    });

    document.getElementById('sortSelect').addEventListener('change', e => {
        sortBy = e.target.value;
        render();
    });

    // Card clicks (edit / delete / tag filter) via delegation
    document.getElementById('projectsGrid').addEventListener('click', e => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const id = parseInt(actionBtn.dataset.id, 10);
            if (actionBtn.dataset.action === 'edit') openModal(id);
            else if (actionBtn.dataset.action === 'delete') openDeleteModal(id);
            return;
        }
        const tagEl = e.target.closest('.tag');
        if (tagEl) {
            const tag = tagEl.dataset.tag;
            activeTagFilter = activeTagFilter === tag ? '' : tag;
            render();
            return;
        }
        const card = e.target.closest('.card');
        if (card) openDetail(parseInt(card.dataset.id, 10));
    });

    // Create/edit modal controls
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

    document.getElementById('projectName').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveProject();
    });

    // Delete modal controls
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
        if (tagInput.value.trim()) {
            addTag(tagInput.value);
            tagInput.value = '';
        }
    });

    document.getElementById('tagInputContainer').addEventListener('click', e => {
        if (e.target.classList.contains('tag-chip-remove')) {
            removeTag(parseInt(e.target.dataset.index, 10));
            return;
        }
        tagInput.focus();
    });

    // Global Escape
    document.getElementById('detailCloseBtn').addEventListener('click', closeDetail);
    document.getElementById('detailOverlay').addEventListener('click', closeDetail);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
            closeDetail();
        }
    });
});
