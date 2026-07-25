import json
import os
import sqlite3
import time
import uuid

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'tourbillon.db')

app = Flask(__name__, static_folder=None)

SCHEMA = """
CREATE TABLE IF NOT EXISTS board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  board_key TEXT NOT NULL DEFAULT 'TB',
  seq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS column_entry (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  color TEXT,
  wip_limit INTEGER,
  collapsed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS card_entry (
  id TEXT PRIMARY KEY,
  key INTEGER,
  column_id TEXT,
  title TEXT,
  description TEXT,
  priority TEXT,
  assignee_name TEXT,
  assignee_color TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  due TEXT,
  created_at INTEGER,
  moved_at INTEGER,
  completed_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  origin_column_id TEXT,
  origin_index INTEGER
);
CREATE TABLE IF NOT EXISTS label_entry (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  text TEXT,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS checklist_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  text TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activity_entry (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  type TEXT,
  message TEXT,
  at INTEGER,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS archived_column_entry (
  id TEXT PRIMARY KEY,
  column_json TEXT,
  cards_json TEXT,
  archived_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0
);
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def rid(prefix):
    return prefix + uuid.uuid4().hex[:10]


def seed_payload():
    now = int(time.time() * 1000)
    day = 86400000
    c1, c2, c3, c4 = rid('col_'), rid('col_'), rid('col_'), rid('col_')

    def label(text, color):
        palette = {
            'дизайн': '--label-purple', 'ui': '--label-pink', 'devops': '--label-blue',
            'backend': '--label-teal', 'qa': '--label-orange', 'docs': '--label-green'
        }
        return {'id': rid('lbl_'), 'text': text, 'color': palette.get(text, '--label-blue')}

    def assignee(name, color):
        return {'name': name, 'color': color}

    def activity(msg, at):
        return {'id': rid('act_'), 'type': 'created', 'message': msg, 'at': at}

    cards = {}
    seq = 0

    def mk(title, desc, priority, col, labels, checklist, done, due, who):
        nonlocal seq
        seq += 1
        cid = rid('card_')
        created = now - (seq % 5) * day
        cards[cid] = {
            'id': cid, 'key': seq, 'title': title, 'desc': desc, 'priority': priority,
            'columnId': col, 'labels': [label(t, None) for t in labels],
            'assignee': assignee(who, '--accent-3') if who else None,
            'checklist': checklist, 'done': done, 'due': due,
            'createdAt': created, 'movedAt': created, 'completedAt': now if done else None,
            'activity': [activity('Задача создана', created)]
        }
        return cid

    t1 = mk('Собрать бриф по редизайну', 'Обсудить с командой цели и ограничения проекта.', 'medium', c1,
            ['дизайн'], [{'text': 'Созвон с заказчиком', 'done': True}, {'text': 'Собрать референсы', 'done': False}],
            False, '', 'Анна Ким')
    t2 = mk('Настроить CI/CD', 'Пайплайн для автосборки и деплоя на staging.', 'high', c1,
            ['devops'], [], False, '', 'Игорь Орлов')
    t3 = mk('Прототип карточек задач', 'Интерактивный прототип в Figma.', 'medium', c2,
            ['дизайн', 'ui'], [{'text': 'Wireframe', 'done': True}, {'text': 'Hi-fi макет', 'done': False}],
            False, '', 'Анна Ким')
    t4 = mk('Ревью API эндпоинтов', '', 'low', c3, ['backend'],
            [{'text': 'Проверить валидацию', 'done': True}], False, '', None)
    t5 = mk('Написать тесты авторизации', '', 'high', c2, ['qa'], [], False, '', 'Игорь Орлов')
    t6 = mk('Обновить документацию', 'Актуализировать README и гайд по деплою.', 'low', c4, ['docs'],
            [{'text': 'README', 'done': True}, {'text': 'CHANGELOG', 'done': True}], True, '', None)

    return {
        'version': 2, 'boardKey': 'TB', 'seq': seq,
        'columns': [
            {'id': c1, 'title': 'Бэклог', 'cardIds': [t1, t2], 'color': 'accent-1', 'wipLimit': None, 'collapsed': False},
            {'id': c2, 'title': 'В работе', 'cardIds': [t3, t5], 'color': 'accent-2', 'wipLimit': 3, 'collapsed': False},
            {'id': c3, 'title': 'На проверке', 'cardIds': [t4], 'color': 'accent-3', 'wipLimit': None, 'collapsed': False},
            {'id': c4, 'title': 'Готово', 'cardIds': [t6], 'color': 'accent-5', 'wipLimit': None, 'collapsed': False}
        ],
        'cards': cards,
        'archived': {'cards': {}, 'columns': []}
    }


def insert_card(cur, card, column_id, position, archived, origin_column_id=None, origin_index=None, archived_at=None):
    a = card.get('assignee') or {}
    cur.execute(
        'INSERT INTO card_entry (id, key, column_id, title, description, priority, assignee_name, assignee_color, '
        'done, due, created_at, moved_at, completed_at, position, archived, archived_at, origin_column_id, origin_index) '
        'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (
            card['id'], card.get('key'), column_id, card.get('title', ''), card.get('desc', ''),
            card.get('priority', 'medium'), a.get('name'), a.get('color'),
            1 if card.get('done') else 0, card.get('due', ''),
            card.get('createdAt'), card.get('movedAt'), card.get('completedAt'),
            position, 1 if archived else 0, archived_at, origin_column_id, origin_index
        )
    )
    for i, l in enumerate(card.get('labels') or []):
        cur.execute('INSERT INTO label_entry (id, card_id, text, color, position) VALUES (?,?,?,?,?)',
                    (l.get('id') or rid('lbl_'), card['id'], l.get('text', ''), l.get('color', ''), i))
    for i, item in enumerate(card.get('checklist') or []):
        cur.execute('INSERT INTO checklist_entry (card_id, text, done, position) VALUES (?,?,?,?)',
                    (card['id'], item.get('text', ''), 1 if item.get('done') else 0, i))
    for i, act in enumerate(card.get('activity') or []):
        cur.execute('INSERT INTO activity_entry (id, card_id, type, message, at, position) VALUES (?,?,?,?,?,?)',
                    (act.get('id') or rid('act_'), card['id'], act.get('type', ''), act.get('message', ''), act.get('at'), i))


def replace_board(data):
    conn = get_db()
    cur = conn.cursor()
    for table in ('label_entry', 'checklist_entry', 'activity_entry', 'card_entry', 'column_entry', 'archived_column_entry', 'board'):
        cur.execute('DELETE FROM ' + table)

    cur.execute('INSERT INTO board (id, board_key, seq) VALUES (1, ?, ?)',
                (data.get('boardKey', 'TB'), data.get('seq', 0)))

    columns = data.get('columns', [])
    cards = data.get('cards', {})

    for pos, col in enumerate(columns):
        cur.execute('INSERT INTO column_entry (id, title, color, wip_limit, collapsed, position) VALUES (?,?,?,?,?,?)',
                    (col['id'], col.get('title', ''), col.get('color'), col.get('wipLimit'),
                     1 if col.get('collapsed') else 0, pos))
        for cpos, cid in enumerate(col.get('cardIds', [])):
            card = cards.get(cid)
            if card:
                insert_card(cur, card, col['id'], cpos, False)

    archived = data.get('archived', {}) or {}
    for entry in (archived.get('cards') or {}).values():
        card = entry.get('card')
        if card:
            insert_card(cur, card, None, 0, True, entry.get('originColumnId'), entry.get('index'), entry.get('archivedAt'))

    for pos, entry in enumerate(archived.get('columns') or []):
        col = entry.get('column') or {}
        cur.execute('INSERT INTO archived_column_entry (id, column_json, cards_json, archived_at, position) VALUES (?,?,?,?,?)',
                    (col.get('id', rid('col_')), json.dumps(col), json.dumps(entry.get('cards', [])), entry.get('archivedAt'), pos))

    conn.commit()
    conn.close()


def build_board():
    conn = get_db()
    board_row = conn.execute('SELECT * FROM board WHERE id=1').fetchone()
    if not board_row:
        conn.close()
        return None

    columns_rows = conn.execute('SELECT * FROM column_entry ORDER BY position').fetchall()
    labels_rows = conn.execute('SELECT * FROM label_entry ORDER BY position').fetchall()
    checklist_rows = conn.execute('SELECT * FROM checklist_entry ORDER BY position').fetchall()
    activity_rows = conn.execute('SELECT * FROM activity_entry ORDER BY position').fetchall()

    labels_by_card, checklist_by_card, activity_by_card = {}, {}, {}
    for r in labels_rows:
        labels_by_card.setdefault(r['card_id'], []).append({'id': r['id'], 'text': r['text'], 'color': r['color']})
    for r in checklist_rows:
        checklist_by_card.setdefault(r['card_id'], []).append({'text': r['text'], 'done': bool(r['done'])})
    for r in activity_rows:
        activity_by_card.setdefault(r['card_id'], []).append({'id': r['id'], 'type': r['type'], 'message': r['message'], 'at': r['at']})

    def hydrate(r, column_id):
        return {
            'id': r['id'], 'key': r['key'], 'title': r['title'], 'desc': r['description'] or '',
            'priority': r['priority'] or 'medium', 'columnId': column_id,
            'labels': labels_by_card.get(r['id'], []),
            'assignee': {'name': r['assignee_name'], 'color': r['assignee_color']} if r['assignee_name'] else None,
            'checklist': checklist_by_card.get(r['id'], []),
            'done': bool(r['done']), 'due': r['due'] or '',
            'createdAt': r['created_at'], 'movedAt': r['moved_at'], 'completedAt': r['completed_at'],
            'activity': activity_by_card.get(r['id'], [])
        }

    col_map = {c['id']: {'id': c['id'], 'title': c['title'], 'cardIds': [], 'color': c['color'],
                          'wipLimit': c['wip_limit'], 'collapsed': bool(c['collapsed'])} for c in columns_rows}
    cards = {}
    for r in conn.execute('SELECT * FROM card_entry WHERE archived=0 ORDER BY position').fetchall():
        card = hydrate(r, r['column_id'])
        cards[r['id']] = card
        if r['column_id'] in col_map:
            col_map[r['column_id']]['cardIds'].append(r['id'])
    columns = [col_map[c['id']] for c in columns_rows]

    archived_cards = {}
    for r in conn.execute('SELECT * FROM card_entry WHERE archived=1').fetchall():
        card = hydrate(r, r['origin_column_id'])
        archived_cards[r['id']] = {'card': card, 'originColumnId': r['origin_column_id'],
                                    'index': r['origin_index'], 'archivedAt': r['archived_at']}

    archived_columns = []
    for r in conn.execute('SELECT * FROM archived_column_entry ORDER BY position').fetchall():
        archived_columns.append({'column': json.loads(r['column_json']), 'cards': json.loads(r['cards_json']),
                                  'archivedAt': r['archived_at']})

    conn.close()
    return {
        'version': 2, 'boardKey': board_row['board_key'], 'seq': board_row['seq'],
        'columns': columns, 'cards': cards,
        'archived': {'cards': archived_cards, 'columns': archived_columns}
    }


@app.after_request
def add_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return resp


@app.route('/api/board', methods=['GET'])
def api_get_board():
    board = build_board()
    if board is None:
        replace_board(seed_payload())
        board = build_board()
    return jsonify(board)


@app.route('/api/board', methods=['PUT'])
def api_put_board():
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or 'columns' not in data or 'cards' not in data:
        return jsonify({'error': 'invalid board payload'}), 400
    replace_board(data)
    return jsonify({'ok': True, 'savedAt': int(time.time() * 1000)})


@app.route('/api/board/reset', methods=['POST'])
def api_reset_board():
    replace_board(seed_payload())
    return jsonify(build_board())


@app.route('/api/health')
def api_health():
    return jsonify({'status': 'ok', 'time': int(time.time() * 1000)})


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(BASE_DIR, path)


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)
