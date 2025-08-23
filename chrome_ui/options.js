const links = document.querySelectorAll('.menu-link');
const content = document.getElementById('content');

function loadContent(url) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      content.innerHTML = html;
    });
}

// Set first menu as active
links[0].classList.add('active');

links.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();

    // Remove active from all links
    links.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Load content dynamically
    loadContent(link.getAttribute('href'));
  });
});
