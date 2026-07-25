import { getBoard, archiveCounts } from './state.js';
import { buildColumnEl, computeColumnProgress } from './columns.js';
import { cardMatchesFilters } from './cards.js';
import { getFilterState } from './toolbar.js';
import { fireConfetti } from './confetti.js';
import { playColumnComplete } from './sound.js';
import { initSortable } from './dragdrop.js';

const progressCache = new Map();
let primed = false;
let quickAddOpenFor = null;

export function updateStatsAndPower() {
  const board = getBoard();
  const allCards = Object.values(board.cards);
  const total = allCards.length;
  const done = allCards.filter(c => c.done).length;
  const overdue = allCards.filter(c => cardIsOverdue(c)).length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statOverdue').textContent = overdue;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('powerFill').style.width = pct + '%';
  const counts = archiveCounts();
  const badge = document.getElementById('archiveBadge');
  if (badge) {
    const n = counts.cards + counts.columns;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }
}

function cardIsOverdue(card) {
  if (!card.due || card.done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(card.due + 'T00:00:00');
  return d < today;
}

export function applyFilters() {
  const board = getBoard();
  const filters = getFilterState();
  document.querySelectorAll('.card').forEach(el => {
    const card = board.cards[el.dataset.cardId];
    if (!card) return;
    el.classList.toggle('filtered-out', !cardMatchesFilters(card, filters));
  });
}

export function setQuickAddTarget(colId) {
  quickAddOpenFor = colId;
}

export function renderBoard(handlers) {
  const board = getBoard();
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  const filters = getFilterState();

  const seenIds = new Set();
  board.columns.forEach((col, index) => {
    seenIds.add(col.id);
    const progress = computeColumnProgress(col, board);
    const prev = progressCache.get(col.id);
    boardEl.appendChild(buildColumnEl(col, board, {
      filters,
      onToggleDone: handlers.onToggleDone,
      onOpen: handlers.onOpen,
      onRename: handlers.onRenameColumn,
      onCycleColor: handlers.onCycleColor,
      onDeleteColumn: handlers.onDeleteColumn,
      onToggleCollapse: handlers.onToggleCollapse,
      onSetWipLimit: handlers.onSetWipLimit,
      quickAddOpenFor,
      onQuickAddOpen: (colId) => { quickAddOpenFor = colId; renderBoard(handlers); },
      onQuickAddClose: () => { quickAddOpenFor = null; renderBoard(handlers); },
      onQuickAdd: (colId, lines) => { handlers.onQuickAdd(colId, lines); quickAddOpenFor = colId; }
    }));
    if (primed && progress === 100 && col.cardIds.length && prev !== 100) {
      fireConfetti((index + 0.5) / board.columns.length);
      playColumnComplete();
    }
    progressCache.set(col.id, progress);
  });
  Array.from(progressCache.keys()).forEach(id => {
    if (!seenIds.has(id)) progressCache.delete(id);
  });
  primed = true;

  const addColEl = document.createElement('button');
  addColEl.className = 'add-column';
  addColEl.innerHTML = '+ Новая колонка';
  addColEl.addEventListener('click', handlers.onAddColumn);
  boardEl.appendChild(addColEl);

  updateStatsAndPower();
  initSortable({ onCardMoved: handlers.onCardMoved, onColumnReordered: handlers.onColumnReordered });
}
