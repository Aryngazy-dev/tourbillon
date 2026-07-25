import { getBoard, setBoard, saveBoard, loadSettings, saveSettings } from './state.js';
import { downloadJSON, escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { setSoundEnabled, isSoundEnabled } from './sound.js';
import { isModalOpen } from './modal.js';

let selectedLabelIds = [];

export function getFilterState() {
  return {
    query: document.getElementById('searchInput').value.trim().toLowerCase(),
    priorityFilter: document.getElementById('priorityFilter').value,
    labelIds: selectedLabelIds,
    assignee: document.getElementById('assigneeFilter').value,
    dueFilter: document.getElementById('dueFilter').value
  };
}

export function refreshFilterOptions() {
  const board = getBoard();
  const labelMap = new Map();
  const assignees = new Set();
  Object.values(board.cards).forEach(card => {
    card.labels.forEach(l => labelMap.set(l.id, l));
    if (card.assignee) assignees.add(card.assignee.name);
  });
  selectedLabelIds = selectedLabelIds.filter(id => labelMap.has(id));

  const popover = document.getElementById('labelFilterPopover');
  popover.innerHTML = '';
  if (!labelMap.size) {
    popover.innerHTML = '<div class="popover-empty">Меток пока нет</div>';
  } else {
    labelMap.forEach(label => {
      const row = document.createElement('label');
      row.className = 'popover-row';
      row.innerHTML = `<input type="checkbox" ${selectedLabelIds.includes(label.id) ? 'checked' : ''}><span class="chip-dot" style="--chip-color:var(${label.color})"></span><span>${escapeHtml(label.text)}</span>`;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selectedLabelIds.push(label.id);
        else selectedLabelIds = selectedLabelIds.filter(id => id !== label.id);
        updateLabelFilterButtonState();
        document.dispatchEvent(new CustomEvent('filters-changed'));
      });
      popover.appendChild(row);
    });
  }
  updateLabelFilterButtonState();

  const assigneeSelect = document.getElementById('assigneeFilter');
  const current = assigneeSelect.value;
  assigneeSelect.innerHTML = '<option value="all">Любой исполнитель</option><option value="none">Без исполнителя</option>';
  Array.from(assignees).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    assigneeSelect.appendChild(opt);
  });
  if (Array.from(assigneeSelect.options).some(o => o.value === current)) assigneeSelect.value = current;
}

function updateLabelFilterButtonState() {
  const btn = document.getElementById('labelFilterBtn');
  btn.classList.toggle('active-filter', selectedLabelIds.length > 0);
  btn.textContent = selectedLabelIds.length ? `Метки (${selectedLabelIds.length})` : 'Метки';
}

function renderArchivePanel() {
  const board = getBoard();
  const listEl = document.getElementById('archiveList');
  listEl.innerHTML = '';
  const cardEntries = Object.values(board.archived.cards).sort((a, b) => b.archivedAt - a.archivedAt);
  const colEntries = board.archived.columns.slice().sort((a, b) => b.archivedAt - a.archivedAt);

  if (!cardEntries.length && !colEntries.length) {
    listEl.innerHTML = '<div class="empty-state">Архив пуст</div>';
    return;
  }

  colEntries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'archive-row';
    row.innerHTML = `
      <div class="archive-row-main">
        <span class="archive-type-badge">колонка</span>
        <span class="archive-title">${escapeHtml(entry.column.title)}</span>
        <span class="archive-meta">${entry.cards.length} карт.</span>
      </div>
      <div class="archive-row-actions">
        <button class="btn ghost" data-action="restore-col">Восстановить</button>
        <button class="btn danger" data-action="purge-col">Удалить</button>
      </div>
    `;
    row.querySelector('[data-action="restore-col"]').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('archive-restore-column', { detail: entry.column.id }));
    });
    row.querySelector('[data-action="purge-col"]').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('archive-purge-column', { detail: entry.column.id }));
    });
    listEl.appendChild(row);
  });

  cardEntries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'archive-row';
    row.innerHTML = `
      <div class="archive-row-main">
        <span class="archive-type-badge card">карточка</span>
        <span class="archive-title">${escapeHtml(entry.card.title)}</span>
      </div>
      <div class="archive-row-actions">
        <button class="btn ghost" data-action="restore-card">Восстановить</button>
        <button class="btn danger" data-action="purge-card">Удалить</button>
      </div>
    `;
    row.querySelector('[data-action="restore-card"]').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('archive-restore-card', { detail: entry.card.id }));
    });
    row.querySelector('[data-action="purge-card"]').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('archive-purge-card', { detail: entry.card.id }));
    });
    listEl.appendChild(row);
  });
}

export function initToolbar(handlers) {
  document.getElementById('searchInput').addEventListener('input', handlers.onFiltersChanged);
  document.getElementById('priorityFilter').addEventListener('change', handlers.onFiltersChanged);
  document.getElementById('assigneeFilter').addEventListener('change', handlers.onFiltersChanged);
  document.getElementById('dueFilter').addEventListener('change', handlers.onFiltersChanged);
  document.addEventListener('filters-changed', handlers.onFiltersChanged);

  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('assigneeFilter').value = 'all';
    document.getElementById('dueFilter').value = 'all';
    selectedLabelIds = [];
    updateLabelFilterButtonState();
    refreshFilterOptions();
    handlers.onFiltersChanged();
  });

  const labelBtn = document.getElementById('labelFilterBtn');
  const labelPopover = document.getElementById('labelFilterPopover');
  labelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    labelPopover.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!labelPopover.contains(e.target) && e.target !== labelBtn) labelPopover.classList.remove('open');
  });

  document.getElementById('addColumnTopBtn').addEventListener('click', handlers.onAddColumn);

  const settings = loadSettings();
  setSoundEnabled(settings.soundEnabled !== false);
  const soundBtn = document.getElementById('soundToggleBtn');
  const applySoundIcon = () => { soundBtn.textContent = isSoundEnabled() ? '🔊' : '🔇'; };
  applySoundIcon();
  soundBtn.addEventListener('click', () => {
    setSoundEnabled(!isSoundEnabled());
    saveSettings({ soundEnabled: isSoundEnabled() });
    applySoundIcon();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    downloadJSON('tourbillon-board.json', getBoard());
    showToast('Доска экспортирована в файл');
  });

  const importInput = document.getElementById('importInput');
  document.getElementById('importBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.columns || !parsed.cards) {
          throw new Error('invalid board shape');
        }
        setBoard(parsed);
        saveBoard();
        handlers.onBoardReplaced();
        showToast('Доска импортирована');
      } catch (err) {
        showToast('Не удалось прочитать файл доски');
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  const archiveOverlay = document.getElementById('archiveOverlay');
  document.getElementById('archiveBtn').addEventListener('click', () => {
    renderArchivePanel();
    archiveOverlay.classList.add('open');
  });
  document.getElementById('closeArchiveBtn').addEventListener('click', () => archiveOverlay.classList.remove('open'));
  archiveOverlay.addEventListener('click', (e) => { if (e.target === archiveOverlay) archiveOverlay.classList.remove('open'); });
  document.getElementById('purgeAllArchiveBtn').addEventListener('click', () => {
    if (confirm('Полностью очистить архив без возможности восстановления?')) {
      handlers.onPurgeAllArchive();
      renderArchivePanel();
    }
  });

  document.addEventListener('archive-restore-card', (e) => { handlers.onRestoreCard(e.detail); renderArchivePanel(); });
  document.addEventListener('archive-purge-card', (e) => { handlers.onPurgeCard(e.detail); renderArchivePanel(); });
  document.addEventListener('archive-restore-column', (e) => { handlers.onRestoreColumn(e.detail); renderArchivePanel(); });
  document.addEventListener('archive-purge-column', (e) => { handlers.onPurgeColumn(e.detail); renderArchivePanel(); });

  const shortcutsOverlay = document.getElementById('shortcutsOverlay');
  document.getElementById('shortcutsBtn').addEventListener('click', () => shortcutsOverlay.classList.add('open'));
  document.getElementById('closeShortcutsBtn').addEventListener('click', () => shortcutsOverlay.classList.remove('open'));
  shortcutsOverlay.addEventListener('click', (e) => { if (e.target === shortcutsOverlay) shortcutsOverlay.classList.remove('open'); });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';
    if (e.key === '/' && !typing) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if ((e.key === 'n' || e.key === 'N') && !typing && !isModalOpen()) {
      e.preventDefault();
      handlers.onNewCardHotkey();
    }
    if (e.key === '?' && !typing) {
      e.preventDefault();
      shortcutsOverlay.classList.toggle('open');
    }
    if (e.key === 'Escape') {
      archiveOverlay.classList.remove('open');
      shortcutsOverlay.classList.remove('open');
      labelPopover.classList.remove('open');
    }
  });

  refreshFilterOptions();
}
