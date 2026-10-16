const tags = Array.from(document.querySelectorAll('.tag'));
const cards = Array.from(document.querySelectorAll('.tool-card'));
const searchInput = document.querySelector('#searchInput');

let activeFilter = 'all';

function applyFilters() {
  const keyword = (searchInput.value || '').trim().toLowerCase();

  cards.forEach((card) => {
    const category = card.dataset.category || '';
    const text = card.textContent.toLowerCase();

    const passFilter = activeFilter === 'all' || category === activeFilter;
    const passSearch = keyword.length === 0 || text.includes(keyword);

    card.classList.toggle('hidden', !(passFilter && passSearch));
  });
}

tags.forEach((tag) => {
  tag.addEventListener('click', () => {
    tags.forEach((item) => item.classList.remove('is-active'));
    tag.classList.add('is-active');
    activeFilter = tag.dataset.filter || 'all';
    applyFilters();
  });
});

searchInput.addEventListener('input', applyFilters);
