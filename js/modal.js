import { getBoard, saveBoard, archiveCard, touchCard } from './state.js';
import { escapeHtml, colorForString, timeAgo, initials } from './utils.js';
import { showToast } from './toast.js';
import { playDelete } from './sound.js';

let activeCardId = null;
let tempLabels = [];
let tempChecklist = [];
let tempPriority = 'medium';
let tempAssignee = null;
let onAfterChange = null;

export function initModal(afterChangeCb) {
  onAfterChange = afterChangeCb;

  document.getElementById('closeModalBtn').addEventListener('click', closeCardModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeCardModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('open')) {
      closeCardModal();
    }
  });

  document.querySelectorAll('.priority-choice').forEach(el => {
    el.addEventListener('click', () => {
      tempPriority = el.dataset.p;
      document.querySelectorAll('.priority-choice').forEach(x => x.classList.toggle('active', x === el));
    });
  });

  document.getElementById('tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && tempLabels.length < 8 && !tempLabels.some(l => l.text.toLowerCase() === v.toLowerCase())) {
        tempLabels.push({ id: 'lbl_' + Math.random().toString(36).slice(2, 8), text: v, color: colorForString(v) });
        e.target.value = '';
        renderLabelsInModal();
      }
    }
  });

  document.getElementById('fieldAssignee').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    tempAssignee = v ? { name: v, color: colorForString(v) } : null;
    renderAssigneePreview();
  });

  document.getElementById('checklistInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v) {
        tempChecklist.push({ text: v, done: false });
        e.target.value = '';
        renderChecklistInModal();
      }
    }
  });

  document.getElementById('saveCardBtn').addEventListener('click', saveActiveCard);
  document.getElementById('deleteCardBtn').addEventListener('click', archiveActiveCard);
}

export function isModalOpen() {
  return document.getElementById('modalOverlay').classList.contains('open');
}

export function openCardModal(cardId) {
  const board = getBoard();
  const card = board.cards[cardId];
  if (!card) return;
  activeCardId = cardId;
  tempLabels = card.labels.map(l => ({ ...l }));
  tempChecklist = card.checklist.map(i => ({ ...i }));
  tempPriority = card.priority;
  tempAssignee = card.assignee ? { ...card.assignee } : null;

  document.getElementById('modalCardKey').textContent = `${board.boardKey}-${card.key || ''}`;
  document.getElementById('fieldTitle').value = card.title;
  document.getElementById('fieldDesc').value = card.desc;
  document.getElementById('fieldDue').value = card.due || '';
  document.getElementById('fieldAssignee').value = card.assignee ? card.assignee.name : '';

  document.querySelectorAll('.priority-choice').forEach(el => {
    el.classList.toggle('active', el.dataset.p === tempPriority);
  });

  renderLabelsInModal();
  renderChecklistInModal();
  renderAssigneePreview();
  renderActivityLog(card);

  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fieldTitle').focus(), 150);
}

export function closeCardModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  activeCardId = null;
}

function renderAssigneePreview() {
  const el = document.getElementById('assigneePreview');
  if (!tempAssignee) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="avatar" style="--avatar-color:var(${tempAssignee.color})">${escapeHtml(initials(tempAssignee.name))}</span><span>${escapeHtml(tempAssignee.name)}</span>`;
}

function renderLabelsInModal() {
  const row = document.getElementById('tagsRow');
  row.querySelectorAll('.chip').forEach(t => t.remove());
  const input = document.getElementById('tagInput');
  tempLabels.forEach((label, idx) => {
    const span = document.createElement('span');
    span.className = 'chip removable';
    span.style.setProperty('--chip-color', `var(${label.color})`);
    span.innerHTML = `<span class="chip-dot"></span>${escapeHtml(label.text)} <span class="chip-x">&times;</span>`;
    span.addEventListener('click', () => {
      tempLabels.splice(idx, 1);
      renderLabelsInModal();
    });
    row.insertBefore(span, input);
  });
}

function renderChecklistInModal() {
  const wrap = document.getElementById('checklistItems');
  wrap.innerHTML = '';
  tempChecklist.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'checklist-item' + (item.done ? ' done' : '');
    row.innerHTML = `<input type="checkbox" ${item.done ? 'checked' : ''}><span>${escapeHtml(item.text)}</span><button>&times;</button>`;
    row.querySelector('input').addEventListener('change', (e) => {
      tempChecklist[idx].done = e.target.checked;
      renderChecklistInModal();
    });
    row.querySelector('button').addEventListener('click', () => {
      tempChecklist.splice(idx, 1);
      renderChecklistInModal();
    });
    wrap.appendChild(row);
  });
}

function renderActivityLog(card) {
  const wrap = document.getElementById('activityLog');
  wrap.innerHTML = '';
  (card.activity || []).slice(0, 12).forEach(entry => {
    const row = document.createElement('div');
    row.className = 'activity-row';
    row.innerHTML = `<span class="activity-dot activity-${entry.type}"></span><span class="activity-message">${escapeHtml(entry.message)}</span><span class="activity-time">${timeAgo(entry.at)}</span>`;
    wrap.appendChild(row);
  });
}

function saveActiveCard() {
  if (!activeCardId) return;
  const board = getBoard();
  const card = board.cards[activeCardId];
  const changes = [];
  const newTitle = document.getElementById('fieldTitle').value.trim() || 'Без названия';
  if (newTitle !== card.title) changes.push('название');
  card.title = newTitle;
  card.desc = document.getElementById('fieldDesc').value.trim();
  const newDue = document.getElementById('fieldDue').value;
  if (newDue !== card.due) changes.push('срок');
  card.due = newDue;
  if (tempPriority !== card.priority) changes.push('приоритет');
  card.priority = tempPriority;
  card.labels = tempLabels.map(l => ({ ...l }));
  card.checklist = tempChecklist.map(i => ({ ...i }));
  const prevAssignee = card.assignee ? card.assignee.name : null;
  const nextAssignee = tempAssignee ? tempAssignee.name : null;
  if (prevAssignee !== nextAssignee) changes.push('исполнитель');
  card.assignee = tempAssignee ? { ...tempAssignee } : null;

  if (changes.length) touchCard(activeCardId, 'edited', `Изменено: ${changes.join(', ')}`);
  saveBoard();
  onAfterChange && onAfterChange();
  closeCardModal();
  showToast('Изменения сохранены');
}

function archiveActiveCard() {
  if (!activeCardId) return;
  const cardId = activeCardId;
  const board = getBoard();
  const card = board.cards[cardId];
  const title = card.title;
  archiveCard(cardId);
  playDelete();
  onAfterChange && onAfterChange();
  closeCardModal();
  showToast(`«${title}» отправлена в архив`, 'Отменить', () => {
    const b = getBoard();
    const entry = b.archived.cards[cardId];
    if (!entry) return;
    delete b.archived.cards[cardId];
    b.cards[cardId] = entry.card;
    const col = b.columns.find(c => c.id === entry.originColumnId) || b.columns[0];
    if (col) {
      const pos = entry.index >= 0 && entry.index <= col.cardIds.length ? entry.index : col.cardIds.length;
      col.cardIds.splice(pos, 0, cardId);
    }
    saveBoard();
    onAfterChange && onAfterChange();
  });
}
