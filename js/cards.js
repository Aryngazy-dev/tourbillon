import { escapeHtml, formatDue, isOverdue, isDueToday, isDueThisWeek, daysSince, initials } from './utils.js';

export function cardMatchesFilters(card, filters) {
  const { query, priorityFilter, labelIds, assignee, dueFilter } = filters;
  if (priorityFilter !== 'all' && card.priority !== priorityFilter) return false;
  if (labelIds && labelIds.length && !card.labels.some(l => labelIds.includes(l.id))) return false;
  if (assignee && assignee !== 'all') {
    if (assignee === 'none' && card.assignee) return false;
    if (assignee !== 'none' && (!card.assignee || card.assignee.name !== assignee)) return false;
  }
  if (dueFilter && dueFilter !== 'all') {
    if (dueFilter === 'overdue' && !isOverdue(card.due, card.done)) return false;
    if (dueFilter === 'today' && !isDueToday(card.due)) return false;
    if (dueFilter === 'week' && !isDueThisWeek(card.due)) return false;
    if (dueFilter === 'none' && card.due) return false;
  }
  if (query) {
    const labelText = card.labels.map(l => l.text).join(' ');
    const assigneeText = card.assignee ? card.assignee.name : '';
    const hay = (card.title + ' ' + card.desc + ' ' + labelText + ' ' + assigneeText).toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

export function renderChecklistBadge(card) {
  if (!card.checklist.length) return '';
  const done = card.checklist.filter(i => i.done).length;
  const complete = done === card.checklist.length;
  return `<span class="card-checklist${complete ? ' complete' : ''}">☑ ${done}/${card.checklist.length}</span>`;
}

function agingInfo(card) {
  if (card.done) return null;
  const days = daysSince(card.movedAt || card.createdAt);
  if (days >= 7) return { level: 'hot', days };
  if (days >= 3) return { level: 'warm', days };
  return null;
}

export function buildCardEl(card, ctx) {
  const el = document.createElement('article');
  const aging = agingInfo(card);
  el.className = 'card' + (card.done ? ' is-done' : '') + (aging ? ` aging-${aging.level}` : '');
  el.dataset.cardId = card.id;
  el.dataset.priority = card.priority;
  if (!ctx.visible) el.classList.add('filtered-out');

  const labelsHtml = card.labels.slice(0, 6).map(l => `<span class="chip" style="--chip-color:var(${l.color})" title="${escapeHtml(l.text)}"><span class="chip-dot"></span>${escapeHtml(l.text)}</span>`).join('');
  const dueOverdue = isOverdue(card.due, card.done);
  const dueHtml = card.due ? `<span class="card-due${dueOverdue ? ' overdue' : ''}">📅 ${formatDue(card.due)}</span>` : '<span></span>';
  const avatarHtml = card.assignee
    ? `<span class="avatar" style="--avatar-color:var(${card.assignee.color})" title="${escapeHtml(card.assignee.name)}">${escapeHtml(initials(card.assignee.name))}</span>`
    : '';

  el.innerHTML = `
    <div class="card-top">
      <span class="card-key">${escapeHtml(ctx.boardKey || 'TB')}-${card.key || ''}</span>
      <span class="priority-dot" title="Приоритет: ${card.priority}"></span>
      <button class="card-done-toggle" title="Отметить выполненным">✓</button>
    </div>
    <h3 class="card-title">${escapeHtml(card.title)}</h3>
    ${card.desc ? `<p class="card-desc">${escapeHtml(card.desc)}</p>` : ''}
    ${labelsHtml ? `<div class="card-tags">${labelsHtml}</div>` : ''}
    <div class="card-footer">
      <div class="card-footer-left">${dueHtml}${renderChecklistBadge(card)}</div>
      ${avatarHtml}
    </div>
  `;

  if (aging) {
    const dot = el.querySelector('.card-top');
    dot.title = `Без движения ${aging.days} дн.`;
  }

  el.querySelector('.card-done-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    ctx.onToggleDone(card.id);
  });
  el.addEventListener('click', () => ctx.onOpen(card.id));
  return el;
}
