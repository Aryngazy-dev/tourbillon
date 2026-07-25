let sortableInstances = [];

export function initSortable({ onCardMoved, onColumnReordered }) {
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  const boardEl = document.getElementById('board');

  const colSortable = Sortable.create(boardEl, {
    animation: 200,
    handle: '.column-header',
    filter: '.column-title, .column-menu-btn, .column-color-btn, .column-collapse-btn, .column-count',
    preventOnFilter: false,
    draggable: '.column',
    ghostClass: 'drag-ghost',
    onEnd: () => {
      const ids = Array.from(boardEl.querySelectorAll('.column')).map(c => c.dataset.columnId);
      onColumnReordered(ids);
    }
  });
  sortableInstances.push(colSortable);

  document.querySelectorAll('.card-list').forEach(list => {
    const s = Sortable.create(list, {
      group: 'cards',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: (evt) => {
        onCardMoved({
          fromColId: evt.from.dataset.columnId,
          toColId: evt.to.dataset.columnId,
          cardId: evt.item.dataset.cardId,
          newIndex: evt.newIndex
        });
      }
    });
    sortableInstances.push(s);
  });
}
