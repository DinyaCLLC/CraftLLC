document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');

    const checkLoginStatus = async () => {
        try {
            const response = await fetch('/api/me');
            if (response.ok) {
                const user = await response.json();
                renderLoggedIn(user);
            } else {
                renderLoggedOut();
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            renderLoggedOut();
        }
    };

    const renderLoggedOut = () => {
        if (!authContainer) return;
        authContainer.innerHTML = `
            <a href="#" id="register-btn" class="btn btn-secondary">Реєстрація</a>
            <a href="#" id="login-btn" class="btn btn-primary">Вхід</a>
        `;
        document.getElementById('login-btn').addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('login');
        });
        document.getElementById('register-btn').addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('register');
        });
    };

    const renderLoggedIn = (user) => {
        if (!authContainer) return;
        const initial = user.username.charAt(0).toUpperCase();
        authContainer.innerHTML = `
            <a href="/account" id="profile-icon" title="Мій акаунт">${initial}</a>
            <button id="logout-btn" title="Вийти">Вийти</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    };

    const showAuthModal = (type) => {
        // Remove existing modal if any
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) existingModal.remove();

        const isLogin = type === 'login';
        const title = isLogin ? 'Вхід' : 'Реєстрація';
        const buttonText = isLogin ? 'Увійти' : 'Зареєструватися';

        const modalHTML = `
            <div id="auth-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <h2>${title}</h2>
                    <form id="auth-form">
                        <div class="form-group">
                            <label for="username">Юзернейм</label>
                            <input type="text" id="username" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Пароль</label>
                            <input type="password" id="password" required>
                        </div>
                        <button type="submit">${buttonText}</button>
                        <p id="modal-message" class="message" style="display: none;"></p>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('auth-modal');
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const messageEl = document.getElementById('modal-message');

            const endpoint = isLogin ? '/api/login' : '/api/register';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await res.json();

                if (res.ok) {
                    if (isLogin) {
                        window.location.reload();
                    } else {
                        messageEl.textContent = 'Реєстрація успішна! Тепер ви можете увійти.';
                        messageEl.className = 'message success';
                        messageEl.style.display = 'block';
                        document.getElementById('auth-form').reset();
                        // Можна автоматично закрити або переключити на логін
                        setTimeout(() => modal.remove(), 2000);
                    }
                } else {
                    messageEl.textContent = `Помилка: ${result.error}`;
                    messageEl.className = 'message error';
                    messageEl.style.display = 'block';
                }
            } catch (err) {
                messageEl.textContent = 'Помилка мережі.';
                messageEl.className = 'message error';
                messageEl.style.display = 'block';
            }
        });
    };

    checkLoginStatus();
});
