import { escapeHtml } from './utils.js';
import { buildCardEl, cardMatchesFilters } from './cards.js';

export const ACCENTS = ['accent-1', 'accent-2', 'accent-3', 'accent-4', 'accent-5', 'accent-6'];

export function computeColumnProgress(col, board) {
  if (!col.cardIds.length) return 0;
  const doneCount = col.cardIds.filter(id => board.cards[id] && board.cards[id].done).length;
  return Math.round((doneCount / col.cardIds.length) * 100);
}

export function nextAccent(current) {
  const idx = ACCENTS.indexOf(current);
  return ACCENTS[(idx + 1) % ACCENTS.length];
}

function buildQuickAdd(col, ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'quick-add';
  wrap.innerHTML = `
    <textarea class="quick-add-input" placeholder="Название задачи... (Enter — добавить, Shift+Enter — новая строка)" rows="2"></textarea>
    <div class="quick-add-actions">
      <button class="btn quick-add-submit">Добавить</button>
      <button class="btn ghost icon quick-add-cancel">&times;</button>
    </div>
  `;
  const textarea = wrap.querySelector('.quick-add-input');
  const submit = () => {
    const raw = textarea.value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length) ctx.onQuickAdd(col.id, lines);
    textarea.value = '';
    textarea.focus();
  };
  wrap.querySelector('.quick-add-submit').addEventListener('click', submit);
  wrap.querySelector('.quick-add-cancel').addEventListener('click', () => ctx.onQuickAddClose(col.id));
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      ctx.onQuickAddClose(col.id);
    }
  });
  setTimeout(() => textarea.focus(), 30);
  return wrap;
}

export function buildColumnEl(col, board, ctx) {
  const el = document.createElement('section');
  const overLimit = col.wipLimit && col.cardIds.length > col.wipLimit;
  el.className = 'column' + (col.collapsed ? ' collapsed' : '') + (overLimit ? ' over-limit' : '');
  el.dataset.columnId = col.id;
  el.style.setProperty('--col-accent', `var(--${col.color || 'accent-1'})`);

  const progress = computeColumnProgress(col, board);
  const circumference = 94.2;
  const offset = circumference - (circumference * progress / 100);
  const countLabel = col.wipLimit ? `${col.cardIds.length}/${col.wipLimit}` : `${col.cardIds.length}`;

  el.innerHTML = `
    <header class="column-header">
      <button class="column-collapse-btn" title="${col.collapsed ? 'Развернуть' : 'Свернуть'}">${col.collapsed ? '▸' : '▾'}</button>
      <div class="gauge">
        <svg viewBox="0 0 40 40">
          <circle class="gauge-ticks" cx="20" cy="20" r="18.5"></circle>
          <circle class="gauge-bg" cx="20" cy="20" r="15"></circle>
          <circle class="gauge-progress" cx="20" cy="20" r="15" style="stroke-dashoffset:${offset}"></circle>
        </svg>
        <span class="gauge-value">${progress}%</span>
      </div>
      <input type="text" class="column-title" value="${escapeHtml(col.title)}" maxlength="40">
      <span class="column-count" title="Нажмите, чтобы задать лимит WIP">${countLabel}</span>
      <button class="column-color-btn" title="Сменить цвет колонки">🎨</button>
      <button class="column-menu-btn" title="Архивировать колонку">✕</button>
    </header>
    <div class="card-list" data-column-id="${col.id}"></div>
    <button class="add-card-btn">+ Добавить карточку</button>
  `;

  const list = el.querySelector('.card-list');
  const filters = ctx.filters;
  col.cardIds.forEach(cid => {
    const card = board.cards[cid];
    if (!card) return;
    const visible = cardMatchesFilters(card, filters);
    list.appendChild(buildCardEl(card, { onToggleDone: ctx.onToggleDone, onOpen: ctx.onOpen, visible, boardKey: board.boardKey }));
  });
  if (!col.cardIds.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Пусто. Перетащите сюда карточку.';
    list.appendChild(empty);
  }

  el.querySelector('.column-title').addEventListener('change', (e) => {
    ctx.onRename(col.id, e.target.value);
  });

  el.querySelector('.column-color-btn').addEventListener('click', () => {
    ctx.onCycleColor(col.id);
  });

  el.querySelector('.column-menu-btn').addEventListener('click', () => {
    ctx.onDeleteColumn(col.id);
  });

  el.querySelector('.column-collapse-btn').addEventListener('click', () => {
    ctx.onToggleCollapse(col.id);
  });

  el.querySelector('.column-count').addEventListener('click', () => {
    ctx.onSetWipLimit(col.id, col.wipLimit);
  });

  const addBtn = el.querySelector('.add-card-btn');
  addBtn.addEventListener('click', () => {
    if (ctx.quickAddOpenFor === col.id) return;
    ctx.onQuickAddOpen(col.id);
  });
  if (ctx.quickAddOpenFor === col.id) {
    addBtn.replaceWith(buildQuickAdd(col, ctx));
  }

  return el;
}
