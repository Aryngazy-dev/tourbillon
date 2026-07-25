import { uid, colorForString } from './utils.js';
import { fetchBoard, pushBoard } from './api.js';

const SETTINGS_KEY = 'tourbillon-settings-v1';
const SCHEMA_VERSION = 2;
const SYNC_DELAY = 500;

let board = null;
let syncTimer = null;
let inFlight = false;
let dirtyWhileInFlight = false;

export function getBoard() {
  return board;
}

export function setBoard(next) {
  board = migrate(next);
}

function emitSync(status) {
  document.dispatchEvent(new CustomEvent('sync-status', { detail: status }));
}

function logActivity(card, type, message) {
  if (!card.activity) card.activity = [];
  card.activity.unshift({ id: uid(), type, message, at: Date.now() });
  if (card.activity.length > 40) card.activity.length = 40;
}

export function touchCard(cardId, type, message) {
  const card = board.cards[cardId];
  if (!card) return;
  logActivity(card, type, message);
  if (type === 'moved') card.movedAt = Date.now();
}

export function nextCardKey() {
  board.seq = (board.seq || 0) + 1;
  return board.seq;
}

function emptyArchive() {
  return { cards: {}, columns: [] };
}

function migrateCard(card) {
  const labels = Array.isArray(card.labels)
    ? card.labels
    : (card.tags || []).map(t => ({ id: 'lbl_' + uid(), text: t, color: colorForString(t) }));
  return {
    id: card.id,
    key: card.key || null,
    title: card.title || 'Без названия',
    desc: card.desc || '',
    priority: card.priority || 'medium',
    columnId: card.columnId,
    labels,
    assignee: card.assignee || null,
    checklist: card.checklist || [],
    done: !!card.done,
    due: card.due || '',
    createdAt: card.createdAt || Date.now(),
    movedAt: card.movedAt || card.createdAt || Date.now(),
    completedAt: card.done ? (card.completedAt || Date.now()) : null,
    activity: card.activity || [{ id: 'act_' + uid(), type: 'created', message: 'Задача создана', at: card.createdAt || Date.now() }]
  };
}

function migrate(raw) {
  if (!raw) return raw;
  if (raw.version === SCHEMA_VERSION) {
    raw.archived = raw.archived || emptyArchive();
    raw.seq = raw.seq || 0;
    raw.boardKey = raw.boardKey || 'TB';
    return raw;
  }
  const cards = {};
  Object.keys(raw.cards || {}).forEach(id => {
    cards[id] = migrateCard(raw.cards[id]);
  });
  let seq = 0;
  const columns = (raw.columns || []).map(col => ({
    id: col.id,
    title: col.title,
    cardIds: col.cardIds || [],
    color: col.color || 'accent-1',
    wipLimit: col.wipLimit || null,
    collapsed: !!col.collapsed
  }));
  Object.keys(cards).forEach(id => {
    seq += 1;
    cards[id].key = cards[id].key || seq;
  });
  return {
    version: SCHEMA_VERSION,
    boardKey: raw.boardKey || 'TB',
    seq: raw.seq || seq,
    columns,
    cards,
    archived: raw.archived || emptyArchive()
  };
}

export function seedBoard() {
  const c1 = 'col_' + uid(), c2 = 'col_' + uid(), c3 = 'col_' + uid(), c4 = 'col_' + uid();
  const cards = {};
  let seq = 0;
  const mk = (title, desc, priority, columnId, labelTexts, checklist, done, due, assignee) => {
    const id = 'card_' + uid();
    seq += 1;
    const now = Date.now();
    cards[id] = {
      id,
      key: seq,
      title,
      desc,
      priority,
      columnId,
      labels: (labelTexts || []).map(t => ({ id: 'lbl_' + uid(), text: t, color: colorForString(t) })),
      assignee: assignee || null,
      checklist: checklist || [],
      done: !!done,
      due: due || '',
      createdAt: now - Math.floor(Math.random() * 5) * 86400000,
      movedAt: now - Math.floor(Math.random() * 4) * 86400000,
      completedAt: done ? now : null,
      activity: [{ id: 'act_' + uid(), type: 'created', message: 'Задача создана', at: now }]
    };
    return id;
  };
  const t1 = mk('Собрать бриф по редизайну', 'Обсудить с командой цели и ограничения проекта.', 'medium', c1, ['дизайн'], [{ text: 'Созвон с заказчиком', done: true }, { text: 'Собрать референсы', done: false }], false, '', { name: 'Анна Ким', color: colorForString('Анна Ким') });
  const t2 = mk('Настроить CI/CD', 'Пайплайн для автосборки и деплоя на staging.', 'high', c1, ['devops'], [], false, '', { name: 'Игорь Орлов', color: colorForString('Игорь Орлов') });
  const t3 = mk('Прототип карточек задач', 'Интерактивный прототип в Figma.', 'medium', c2, ['дизайн', 'ui'], [{ text: 'Wireframe', done: true }, { text: 'Hi-fi макет', done: false }], false, '', { name: 'Анна Ким', color: colorForString('Анна Ким') });
  const t4 = mk('Ревью API эндпоинтов', '', 'low', c3, ['backend'], [{ text: 'Проверить валидацию', done: true }], false, '', null);
  const t5 = mk('Написать тесты авторизации', '', 'high', c2, ['qa'], [], false, '', { name: 'Игорь Орлов', color: colorForString('Игорь Орлов') });
  const t6 = mk('Обновить документацию', 'Актуализировать README и гайд по деплою.', 'low', c4, ['docs'], [{ text: 'README', done: true }, { text: 'CHANGELOG', done: true }], true, '', null);
  return {
    version: SCHEMA_VERSION,
    boardKey: 'TB',
    seq,
    columns: [
      { id: c1, title: 'Бэклог', cardIds: [t1, t2], color: 'accent-1', wipLimit: null, collapsed: false },
      { id: c2, title: 'В работе', cardIds: [t3, t5], color: 'accent-2', wipLimit: 3, collapsed: false },
      { id: c3, title: 'На проверке', cardIds: [t4], color: 'accent-3', wipLimit: null, collapsed: false },
      { id: c4, title: 'Готово', cardIds: [t6], color: 'accent-5', wipLimit: null, collapsed: false }
    ],
    cards,
    archived: emptyArchive()
  };
}

export async function loadBoard() {
  try {
    const raw = await fetchBoard();
    board = migrate(raw);
    emitSync('saved');
    return board;
  } catch (e) {
    board = seedBoard();
    emitSync('offline');
    return board;
  }
}

async function flushSync() {
  if (!board) return;
  if (inFlight) {
    dirtyWhileInFlight = true;
    return;
  }
  inFlight = true;
  emitSync('saving');
  try {
    await pushBoard(board);
    emitSync('saved');
  } catch (e) {
    emitSync('error');
  } finally {
    inFlight = false;
    if (dirtyWhileInFlight) {
      dirtyWhileInFlight = false;
      scheduleSync();
    }
  }
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  emitSync('pending');
  syncTimer = setTimeout(flushSync, SYNC_DELAY);
}

export function saveBoard() {
  scheduleSync();
  return true;
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { soundEnabled: true };
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

export function archiveCard(cardId) {
  const card = board.cards[cardId];
  if (!card) return null;
  const col = board.columns.find(c => c.id === card.columnId);
  const index = col ? col.cardIds.indexOf(cardId) : -1;
  if (col) col.cardIds = col.cardIds.filter(id => id !== cardId);
  delete board.cards[cardId];
  const entry = { card, originColumnId: card.columnId, index, archivedAt: Date.now() };
  board.archived.cards[cardId] = entry;
  saveBoard();
  return entry;
}

export function restoreCard(cardId) {
  const entry = board.archived.cards[cardId];
  if (!entry) return false;
  delete board.archived.cards[cardId];
  board.cards[cardId] = entry.card;
  let col = board.columns.find(c => c.id === entry.originColumnId);
  if (!col) col = board.columns[0];
  if (col) {
    const pos = entry.index >= 0 && entry.index <= col.cardIds.length ? entry.index : col.cardIds.length;
    col.cardIds.splice(pos, 0, cardId);
    entry.card.columnId = col.id;
  }
  saveBoard();
  return true;
}

export function purgeCard(cardId) {
  delete board.archived.cards[cardId];
  saveBoard();
}

export function archiveColumn(colId) {
  const col = board.columns.find(c => c.id === colId);
  if (!col) return null;
  const cardEntries = col.cardIds.map(id => board.cards[id]).filter(Boolean);
  cardEntries.forEach(c => delete board.cards[c.id]);
  board.columns = board.columns.filter(c => c.id !== colId);
  const entry = { column: col, cards: cardEntries, archivedAt: Date.now() };
  board.archived.columns.push(entry);
  saveBoard();
  return entry;
}

export function restoreColumn(colId) {
  const idx = board.archived.columns.findIndex(e => e.column.id === colId);
  if (idx === -1) return false;
  const entry = board.archived.columns[idx];
  board.archived.columns.splice(idx, 1);
  board.columns.push(entry.column);
  entry.cards.forEach(c => { board.cards[c.id] = c; });
  saveBoard();
  return true;
}

export function purgeColumn(colId) {
  board.archived.columns = board.archived.columns.filter(e => e.column.id !== colId);
  saveBoard();
}

export function purgeAllArchive() {
  board.archived = emptyArchive();
  saveBoard();
}

export function archiveCounts() {
  return {
    cards: Object.keys(board.archived.cards).length,
    columns: board.archived.columns.length
  };
}
