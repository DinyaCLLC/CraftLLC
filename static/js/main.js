document.addEventListener("DOMContentLoaded", () => {
    // ЛОГІКА ДЛЯ АДАПТИВНОГО МЕНЮ
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true' || false;

            // Перемикаємо клас active для відображення меню
            navMenu.classList.toggle('active');

            // Оновлюємо атрибут для доступності
            menuToggle.setAttribute('aria-expanded', !isExpanded);
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    if (loaderWrapper) {
        loaderWrapper.style.display = 'none';
    }
});
