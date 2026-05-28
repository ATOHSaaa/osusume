export function initRandomArticleLists() {
  document.querySelectorAll('[data-random-list]').forEach((list) => {
    if (!(list instanceof HTMLUListElement) || list.dataset.randomReady === 'true') return;

    const limit = Number(list.dataset.randomLimit) || 12;
    const items = [...list.children];

    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    list.replaceChildren(...items);

    items.forEach((item, index) => {
      if (item instanceof HTMLElement) {
        item.hidden = false;
        item.classList.toggle('is-overflow', index >= limit);
      }
    });

    list.dataset.randomReady = 'true';
  });
}

export function bindRandomArticleLists() {
  initRandomArticleLists();
  document.addEventListener('astro:page-load', initRandomArticleLists);
}
