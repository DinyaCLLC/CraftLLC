document.addEventListener('DOMContentLoaded', () => {
    const usernameDisplay = document.getElementById('username-display');
    const changePasswordForm = document.getElementById('change-password-form');
    const passwordMessage = document.getElementById('password-message');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteMessage = document.getElementById('delete-message');

    // 1. Перевіряємо статус логіну і завантажуємо дані
    fetch('/api/me')
        .then(res => {
            if (!res.ok) {
                // Якщо користувач не авторизований, перенаправляємо на головну
                window.location.href = '/';
                throw new Error('Not authenticated');
            }
            return res.json();
        })
        .then(data => {
            if (data.username) {
                usernameDisplay.textContent = data.username;
            }
        })
        .catch(err => {
            console.error('Auth check failed:', err);
            // Переконатись, що неавторизований користувач не бачить сторінку
            document.body.innerHTML = '<h1>Доступ заборонено</h1><p><a href="/">На головну</a></p>';
        });

    // 2. Обробка форми зміни пароля
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        passwordMessage.textContent = '';
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;

        if (!oldPassword || !newPassword) {
            passwordMessage.textContent = 'Всі поля обовʼязкові.';
            passwordMessage.className = 'message error';
            return;
        }

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            const result = await res.json();

            if (res.ok) {
                passwordMessage.textContent = 'Пароль успішно змінено!';
                passwordMessage.className = 'message success';
                changePasswordForm.reset();
            } else {
                passwordMessage.textContent = `Помилка: ${result.error || 'Не вдалося змінити пароль'}`;
                passwordMessage.className = 'message error';
            }
        } catch (err) {
            passwordMessage.textContent = 'Сталася помилка мережі.';
            passwordMessage.className = 'message error';
        }
    });

    // 3. Обробка видалення акаунту
    deleteAccountBtn.addEventListener('click', async () => {
        deleteMessage.textContent = '';

        const password = prompt('Для підтвердження видалення введіть ваш пароль:');
        if (password === null) return; // Користувач натиснув "Скасувати"

        if (!password) {
            deleteMessage.textContent = 'Пароль обовʼязковий для видалення.';
            deleteMessage.className = 'message error';
            return;
        }

        const isConfirmed = confirm('ВИ ВПЕВНЕНІ? Ця дія незворотна. Ваш акаунт буде видалено назавжди.');
        if (!isConfirmed) return;

        try {
            const res = await fetch('/api/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                alert('Ваш акаунт було видалено. Зараз вас буде перенаправлено на головну сторінку.');
                window.location.href = '/';
            } else {
                const result = await res.json();
                deleteMessage.textContent = `Помилка: ${result.error || 'Не вдалося видалити акаунт'}`;
                deleteMessage.className = 'message error';
            }
        } catch (err) {
            deleteMessage.textContent = 'Сталася помилка мережі.';
            deleteMessage.className = 'message error';
        }
    });
});
