async function call(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = new Error('request failed ' + res.status);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function fetchBoard() {
  return call('/api/board');
}

export function pushBoard(board) {
  return call('/api/board', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board)
  });
}

export function resetBoard() {
  return call('/api/board/reset', { method: 'POST' });
}

export function ping() {
  return call('/api/health');
}
