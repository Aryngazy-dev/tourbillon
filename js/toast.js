export function showToast(text, actionLabel, actionFn, duration) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.onclick = () => { actionFn(); remove(); };
    el.appendChild(btn);
  }
  container.appendChild(el);
  function remove() {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }
  setTimeout(remove, duration || 4200);
}
