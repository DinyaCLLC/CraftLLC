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

    // Cookie Consent Logic
    if (!localStorage.getItem('cookie-consent')) {
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.innerHTML = `
            <p>Цей сайт використовує cookies для автентифікації та покращення роботи сайту. 
            Продовжуючи користування, ви погоджуєтесь з нашою <a href="/privacy">політикою</a>.</p>
            <button class="cookie-btn">Зрозуміло</button>
        `;
        document.body.appendChild(banner);

        banner.querySelector('.cookie-btn').addEventListener('click', () => {
            localStorage.setItem('cookie-consent', 'true');
            banner.remove();
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    if (loaderWrapper) {
        loaderWrapper.style.display = 'none';
    }
});
