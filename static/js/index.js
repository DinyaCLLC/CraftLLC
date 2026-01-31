window.addEventListener('message', (event) => {
    if (event.data.type === 'openCheatCodeModal') {
        const cheatCodeModal = document.getElementById('cheatCodeModal');
        const cheatCodeInput = document.getElementById('cheatCodeInput');
        const modalMessage = document.getElementById('modalMessage');

        cheatCodeInput.value = '';
        modalMessage.textContent = '';
        cheatCodeModal.style.display = 'flex';
    } else if (event.data.type === 'CHEAT_CODE_RESULT') {
        const cheatCodeModal = document.getElementById('cheatCodeModal');
        const modalMessage = document.getElementById('modalMessage');
        if (event.data.success) {
            modalMessage.style.color = 'green';
            modalMessage.textContent = 'Чит-код прийнято! Рецепт розблоковано.';
            setTimeout(() => {
                cheatCodeModal.style.display = 'none';
            }, 1500);
        } else {
            modalMessage.style.color = 'red';
            modalMessage.textContent = 'Невірний чит-код або рецепт вже доступний.';
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const cheatCodeModal = document.getElementById('cheatCodeModal');
    const cancelCheatCodeBtn = document.getElementById('cancelCheatCode');
    const submitCheatCodeBtn = document.getElementById('submitCheatCode');
    const cheatCodeInput = document.getElementById('cheatCodeInput');
    const modalMessage = document.getElementById('modalMessage');
    const recipesIframe = document.getElementById('recipesIframe');

    cancelCheatCodeBtn.addEventListener('click', () => {
        cheatCodeModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == cheatCodeModal) {
            cheatCodeModal.style.display = 'none';
        }
    });

    submitCheatCodeBtn.addEventListener('click', () => {
        const enteredCode = cheatCodeInput.value.trim().toLowerCase();
        if (recipesIframe && recipesIframe.contentWindow) {
            recipesIframe.contentWindow.postMessage({ type: 'SUBMIT_CHEAT_CODE', code: enteredCode }, '*');
        }
    });
});

function adjustAllIframesHeight() {
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
        try {
            if (iframe.contentWindow && iframe.contentWindow.document && iframe.contentWindow.document.body) {
                const contentHeight = iframe.contentWindow.document.body.scrollHeight;
                if (contentHeight > 0) {
                    iframe.style.height = (contentHeight + 20) + "px"; // Add a 20px buffer
                }
            }
        } catch (e) {
            console.error("Не вдається отримати висоту вмісту через політику безпеки браузера або iframe ще не завантажився:", e);
        }
    });
}

window.addEventListener("load", () => {
    adjustAllIframesHeight();
    setInterval(adjustAllIframesHeight, 500);
});

window.addEventListener('message', (event) => {
    if (event.data.type === 'openCheatCodeModal') {
        const cheatCodeModal = document.getElementById('cheatCodeModal');
        const cheatCodeInput = document.getElementById('cheatCodeInput');
        const modalMessage = document.getElementById('modalMessage');

        cheatCodeInput.value = '';
        modalMessage.textContent = '';
        cheatCodeModal.style.display = 'flex';
    }
});

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
