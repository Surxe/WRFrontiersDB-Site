/**
 * toc.js
 * Generic Table of Contents generator.
 * Finds the container `#toc-container` and populates it with links to all headings
 * that match the `data-toc-selector` on the container.
 */
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('toc-container');
  if (!container) return;

  // Default to finding all h2 elements if no selector is provided
  const selector = container.dataset.tocSelector || 'h2';
  const headings = document.querySelectorAll(selector);

  if (headings.length === 0) {
    // Hide the whole wrapper if no headings found
    const wrapper = container.closest('.toc-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    return;
  }

  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';

  headings.forEach((heading, index) => {
    // If the heading lacks an ID, create a URL-friendly one so we can link to it
    if (!heading.id) {
      let baseId = heading.textContent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (!baseId) baseId = 'heading';
      heading.id = `${baseId}-${index}`;
    }

    const listItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;

    listItem.appendChild(link);
    tocList.appendChild(listItem);
  });

  container.appendChild(tocList);
});
