import { uid, colorForString } from './utils.js';
import { getBoard, loadBoard, saveBoard, touchCard, nextCardKey, archiveColumn, restoreCard, purgeCard, restoreColumn, purgeColumn, purgeAllArchive } from './state.js';
import { renderBoard, applyFilters } from './render.js';
import { nextAccent } from './columns.js';
import { initModal, openCardModal } from './modal.js';
import { initToolbar, refreshFilterOptions } from './toolbar.js';
import { showToast } from './toast.js';
import { playDrop, playDone } from './sound.js';

function startClock() {
  const el = document.getElementById('clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

function initSyncIndicator() {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (!dot || !label) return;
  const labels = {
    pending: 'Изменения…',
    saving: 'Сохранение…',
    saved: 'Синхронизировано',
    error: 'Не удалось сохранить',
    offline: 'Нет связи с сервером'
  };
  document.addEventListener('sync-status', (e) => {
    const status = e.detail;
    dot.className = 'sync-dot sync-' + status;
    label.textContent = labels[status] || '';
  });
}

function refresh() {
  renderBoard(handlers);
  refreshFilterOptions();
}

function addColumnFlow() {
  const title = prompt('Название колонки:', 'Новая колонка');
  if (title === null) return;
  const board = getBoard();
  const col = { id: 'col_' + uid(), title: title.trim() || 'Без названия', cardIds: [], color: 'accent-1', wipLimit: null, collapsed: false };
  board.columns.push(col);
  saveBoard();
  refresh();
}

function makeCard(board, colId, title) {
  const id = 'card_' + uid();
  const now = Date.now();
  const card = {
    id,
    key: nextCardKey(),
    title: title || 'Новая задача',
    desc: '',
    priority: 'medium',
    columnId: colId,
    labels: [],
    assignee: null,
    checklist: [],
    done: false,
    due: '',
    createdAt: now,
    movedAt: now,
    completedAt: null,
    activity: [{ id: 'act_' + uid(), type: 'created', message: 'Задача создана', at: now }]
  };
  board.cards[id] = card;
  const col = board.columns.find(c => c.id === colId);
  if (col) col.cardIds.push(id);
  return id;
}

const handlers = {
  onToggleDone(cardId) {
    const board = getBoard();
    const card = board.cards[cardId];
    if (!card) return;
    card.done = !card.done;
    card.completedAt = card.done ? Date.now() : null;
    touchCard(cardId, card.done ? 'done' : 'reopened', card.done ? 'Отмечена выполненной' : 'Возвращена в работу');
    if (card.done) playDone();
    saveBoard();
    refresh();
  },
  onOpen(cardId) {
    openCardModal(cardId);
  },
  onRenameColumn(colId, value) {
    const board = getBoard();
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;
    col.title = value.trim() || 'Без названия';
    saveBoard();
  },
  onCycleColor(colId) {
    const board = getBoard();
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;
    col.color = nextAccent(col.color || 'accent-1');
    saveBoard();
    refresh();
  },
  onToggleCollapse(colId) {
    const board = getBoard();
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;
    col.collapsed = !col.collapsed;
    saveBoard();
    refresh();
  },
  onSetWipLimit(colId, current) {
    const value = prompt('Лимит задач в колонке (пусто — без лимита):', current || '');
    if (value === null) return;
    const board = getBoard();
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;
    const n = parseInt(value, 10);
    col.wipLimit = Number.isFinite(n) && n > 0 ? n : null;
    saveBoard();
    refresh();
  },
  onDeleteColumn(colId) {
    const board = getBoard();
    const col = board.columns.find(c => c.id === colId);
    if (!col) return;
    if (col.cardIds.length) {
      if (!confirm(`Отправить в архив колонку «${col.title}» и все карточки внутри (${col.cardIds.length})?`)) return;
    }
    const title = col.title;
    archiveColumn(colId);
    refresh();
    showToast(`Колонка «${title}» отправлена в архив`, 'Отменить', () => {
      restoreColumn(colId);
      refresh();
    });
  },
  onAddCard(colId) {
    const board = getBoard();
    const id = makeCard(board, colId, 'Новая задача');
    saveBoard();
    refresh();
    openCardModal(id);
  },
  onQuickAdd(colId, lines) {
    const board = getBoard();
    lines.forEach(title => makeCard(board, colId, title));
    saveBoard();
    refresh();
    playDrop();
  },
  onAddColumn: addColumnFlow,
  onCardMoved({ fromColId, toColId, cardId, newIndex }) {
    const board = getBoard();
    const fromCol = board.columns.find(c => c.id === fromColId);
    const toCol = board.columns.find(c => c.id === toColId);
    if (fromCol) fromCol.cardIds = fromCol.cardIds.filter(id => id !== cardId);
    if (toCol) toCol.cardIds.splice(newIndex, 0, cardId);
    if (board.cards[cardId]) board.cards[cardId].columnId = toColId;
    if (fromColId !== toColId) {
      const colName = toCol ? toCol.title : '';
      touchCard(cardId, 'moved', `Перемещена в «${colName}»`);
    }
    saveBoard();
    playDrop();
    refresh();
  },
  onColumnReordered(orderedIds) {
    const board = getBoard();
    board.columns.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    saveBoard();
  },
  onFiltersChanged() {
    applyFilters();
  },
  onBoardReplaced() {
    refresh();
  },
  onNewCardHotkey() {
    const board = getBoard();
    if (!board.columns.length) return;
    handlers.onAddCard(board.columns[0].id);
  },
  onRestoreCard(cardId) {
    restoreCard(cardId);
    refresh();
    showToast('Карточка восстановлена');
  },
  onPurgeCard(cardId) {
    purgeCard(cardId);
    refresh();
  },
  onRestoreColumn(colId) {
    restoreColumn(colId);
    refresh();
    showToast('Колонка восстановлена');
  },
  onPurgeColumn(colId) {
    purgeColumn(colId);
    refresh();
  },
  onPurgeAllArchive() {
    purgeAllArchive();
    refresh();
    showToast('Архив очищен');
  }
};

(async function init() {
  startClock();
  initSyncIndicator();
  await loadBoard();
  const loader = document.getElementById('boardLoader');
  if (loader) loader.remove();
  initModal(refresh);
  initToolbar(handlers);
  renderBoard(handlers);
  refreshFilterOptions();
})();
