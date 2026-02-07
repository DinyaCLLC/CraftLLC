let currentPage = 1;
let filteredCards = [];
const recipesPerPage = 5;
let countdownIntervals = {};
let cheatCodesUsed = JSON.parse(localStorage.getItem('cheatCodesUsed')) || {};

// --- Interactions Logic ---

async function fetchInteractionData(recipeId) {
    try {
        const res = await fetch(`/api/recipes/data?id=${recipeId}`);
        return await res.json();
    } catch (e) {
        return { likesCount: 0, comments: [] };
    }
}

async function toggleLike(recipeId, btn) {
    try {
        const res = await fetch('/api/recipes/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: recipeId })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const countSpan = btn.querySelector('.like-count');
        countSpan.textContent = data.count;
        btn.classList.toggle('active');
    } catch (e) {
        alert(e.message);
    }
}

async function handleCommentSubmit(recipeId, input, container) {
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const res = await fetch('/api/recipes/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: recipeId, content })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        input.value = '';
        renderComment(data, container, recipeId);
    } catch (e) {
        alert(e.message);
    }
}

// Global user data for role checks
let currentUserData = null;

async function fetchUserRole() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) currentUserData = await res.json();
    } catch (e) {}
}

function renderComment(comment, container, recipeId) {
    const div = document.createElement('div');
    div.classList.add('recipe-comment');
    div.dataset.id = comment.id;
    
    const time = new Date(comment.timestamp).toLocaleString('uk-UA');
    const canHeart = currentUserData && (currentUserData.role === 'admin' || currentUserData.role === 'responder');
    const canReply = currentUserData && (currentUserData.role === 'admin' || currentUserData.role === 'responder' || currentUserData.username === comment.username);
    
    div.innerHTML = `
        <div class="comment-header">
            <strong>${comment.nickname}</strong> <span class="comment-time">${time}</span>
            ${comment.hearts && comment.hearts.length ? '<span class="admin-heart">❤</span>' : ''}
        </div>
        <div class="comment-content">${comment.content}</div>
        <div class="comment-actions">
            <button class="comment-like-btn" onclick="interactComment('${recipeId}', '${comment.id}', 'like', this)">
                <i class="far fa-thumbs-up"></i> <span class="c-like-count">${comment.likes ? comment.likes.length : 0}</span>
            </button>
            ${canReply ? `<button class="reply-toggle-btn" onclick="toggleReplyForm('${comment.id}')">Відповісти</button>` : ''}
            ${canHeart ? `
            <button class="heart-btn ${comment.hearts && comment.hearts.includes(currentUserData.username) ? 'hearted' : ''}" onclick="interactComment('${recipeId}', '${comment.id}', 'heart', this)">
                <i class="fas fa-heart"></i>
            </button>` : ''}
        </div>
        <div id="replies-${comment.id}" class="comment-replies">
            ${(comment.replies || []).map(r => `
                <div class="comment-reply">
                    <strong>${r.nickname}</strong>: ${r.content}
                    ${r.hearts && r.hearts.length ? ' <span class="admin-heart">❤</span>' : ''}
                </div>
            `).join('')}
        </div>
        <div id="reply-form-${comment.id}" class="reply-form hidden">
            <input type="text" placeholder="Ваша відповідь..." id="reply-input-${comment.id}">
            <button onclick="submitReply('${recipeId}', '${comment.id}')">Надіслати</button>
        </div>
    `;
    container.prepend(div);
}

window.toggleReplyForm = function(commentId) {
    document.getElementById(`reply-form-${commentId}`).classList.toggle('hidden');
};

window.interactComment = async function(recipeId, commentId, action, btn) {
    try {
        const res = await fetch('/api/comments/interact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId, commentId, action })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        if (action === 'like') {
            const count = btn.querySelector('.c-like-count');
            count.textContent = parseInt(count.textContent) + (data.liked ? 1 : -1); 
            // Correct logic would be to reload or use data returning from API
            location.reload(); // Simple for now
        } else {
            location.reload();
        }
    } catch (e) {
        alert(e.message);
    }
};

window.submitReply = async function(recipeId, commentId) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const res = await fetch('/api/comments/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId, commentId, content })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        input.value = '';
        const repliesContainer = document.getElementById(`replies-${commentId}`);
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('comment-reply');
        replyDiv.innerHTML = `<strong>${data.nickname}</strong>: ${data.content}`;
        repliesContainer.appendChild(replyDiv);
        document.getElementById(`reply-form-${commentId}`).classList.add('hidden');
    } catch (e) {
        alert(e.message);
    }
};

async function loadInteractions(card, recipeId) {
    const data = await fetchInteractionData(recipeId);
    const likeBtn = card.querySelector('.like-btn');
    if (likeBtn) {
        const countSpan = likeBtn.querySelector('.like-count');
        if (countSpan) countSpan.textContent = data.likesCount;
    }
    
    const commentCount = card.querySelector('.comment-count');
    if (commentCount) commentCount.textContent = data.comments.length;
    
    const commentsList = card.querySelector('.comments-list');
    if (commentsList && data.comments) {
        data.comments.forEach(c => renderComment(c, commentsList, recipeId));
    }
}

// --- Restored Core Logic ---

const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
    for (let j = 1; j <= b.length; j += 1) { matrix[j][0] = j; }
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
        }
    }
    return matrix[b.length][a.length];
};

function normalizeText(text) {
    return text.toLowerCase().replace(/[^\u0400-\u04FFa-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatCountdown(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const hours = totalHours % 24, minutes = totalMinutes % 60, seconds = totalSeconds % 60;
    return `<span class="value">${totalDays}</span><span class="label">дн</span> <span class="value">${hours}</span><span class="label">год</span> <span class="value">${minutes}</span><span class="label">хв</span> <span class="value">${seconds}</span><span class="label">с</span>`;
}

function displayPage(page) {
    const recipeCards = document.querySelectorAll('.card');
    recipeCards.forEach(card => card.style.display = 'none');
    const startIndex = (page - 1) * recipesPerPage;
    const endIndex = startIndex + recipesPerPage;
    const pageCards = filteredCards.slice(startIndex, endIndex);
    pageCards.forEach(card => card.style.display = 'block');
    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredCards.length / recipesPerPage);
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) pageInfo.textContent = `Сторінка ${currentPage} з ${totalPages || 1}`;
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    if (prev) prev.disabled = currentPage === 1;
    if (next) next.disabled = currentPage === totalPages || totalPages === 0;
}

function filterAndSortRecipes() {
    const searchTerm = normalizeText(document.getElementById('recipeSearch').value);
    const selectedType = document.getElementById('recipeSort').value;
    const recipeCards = Array.from(document.querySelectorAll('.card'));

    filteredCards = recipeCards.filter(card => {
        const matchesType = selectedType === 'all' || card.dataset.recipetype === selectedType;
        if (!matchesType) return false;
        if (!searchTerm) return true;
        const text = normalizeText(card.querySelector('.card__title').textContent + (card.dataset.tags || ''));
        return text.includes(searchTerm) || levenshtein(searchTerm, text) < 3;
    });

    currentPage = 1;
    displayPage(currentPage);
}

function processRecipeCards() {
    const now = new Date();
    document.querySelectorAll('.card').forEach((card, index) => {
        const dateAttr = card.dataset.date;
        const cardId = `card-${index}`;
        if (countdownIntervals[cardId]) clearInterval(countdownIntervals[cardId]);
        if (dateAttr && !cheatCodesUsed[cardId]) {
            const [d, m, y] = dateAttr.split('.').map(Number);
            const release = new Date(y, m - 1, d);
            if (release > now) {
                const title = card.querySelector('.card__title');
                if (title) {
                    title.dataset.origText = title.textContent;
                    title.textContent = "Секрет";
                    title.style.pointerEvents = "none";
                }
                const desc = card.querySelector('.card__desc');
                if (desc) {
                    desc.dataset.origHtml = desc.innerHTML;
                    const update = () => {
                        const diff = release - new Date();
                        if (diff <= 0) {
                            location.reload();
                        } else {
                            desc.innerHTML = `Доступно через: ${formatCountdown(diff)}`;
                        }
                    };
                    update();
                    countdownIntervals[cardId] = setInterval(update, 1000);
                }
            }
        }
    });
}

function generateRecipeCard(recipe, index) {
    const card = document.createElement('div');
    card.classList.add('card');
    const recipeId = recipe.id || `recipe-${index}`;
    card.dataset.id = recipeId;
    card.dataset.recipetype = recipe.recipe_type;
    card.dataset.tags = recipe.keywords.join(', ');
    if (recipe.date) card.dataset.date = recipe.date;

    let videoElement = '';
    if (recipe.video_id) {
        videoElement = `<div class="card__vid-placeholder" data-videoid="${recipe.video_id}">
            <iframe width="100%" height="200" src="https://www.youtube.com/embed/${recipe.video_id}" frameborder="0" allowfullscreen></iframe>
        </div>`;
    }

    card.innerHTML = `
    ${videoElement}
    <div class="card__body">
        <a href="#" class="card__title">${recipe.name}</a>
        <div class="recipe-interactions">
            <button class="like-btn" onclick="toggleLike('${recipeId}', this)">
                <i class="fas fa-heart"></i> <span class="like-count">0</span>
            </button>
            <button class="comment-toggle-btn" onclick="this.closest('.card').querySelector('.comments-section').classList.toggle('hidden')">
                <i class="fas fa-comment"></i> <span class="comment-count">0</span>
            </button>
        </div>
        <p class="card__desc">${recipe.description || ''}</p>
        
        <div class="comments-section hidden">
            <div class="add-comment">
                <input type="text" placeholder="Напишіть коментар..." class="comment-input">
                <button class="post-comment-btn" onclick="handleCommentSubmit('${recipeId}', this.previousElementSibling, this.closest('.comments-section').querySelector('.comments-list'))">Послати</button>
            </div>
            <div class="comments-list"></div>
        </div>
    </div>
    `;

    loadInteractions(card, recipeId);

    card.addEventListener('dblclick', () => {
        const modal = document.getElementById('cheatCodeModal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('cheatCodeInput').value = '';
            document.getElementById('modalMessage').textContent = '';
        }
    });

    return card;
}

async function loadRecipes() {
    const response = await fetch('/recipes/list.json');
    const recipes = await response.json();
    const container = document.getElementById('recipesContainer');
    if (container) {
        container.innerHTML = '';
        recipes.forEach((r, i) => container.appendChild(generateRecipeCard(r, i)));
    }
    processRecipeCards();
    filterAndSortRecipes();
}

document.addEventListener("DOMContentLoaded", () => {
    const submitCheat = document.getElementById('submitCheatCode');
    if (submitCheat) {
        submitCheat.addEventListener('click', async () => {
            const code = document.getElementById('cheatCodeInput').value.trim();
            if (!code) return;

            // 1. Try Admin API
            try {
                const res = await fetch('/api/auth/admin-cheat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                
                if (data.success) {
                    const msg = document.getElementById('modalMessage');
                    msg.style.color = 'green';
                    msg.textContent = data.message;
                    setTimeout(() => location.reload(), 1500);
                    return;
                }
            } catch (e) {
                console.error("Admin check failed", e);
            }

            // 2. Try Recipe Unlock
            let found = false;
            document.querySelectorAll('.card').forEach((card, index) => {
                if (card.dataset.cheatcode && card.dataset.cheatcode.toLowerCase() === code.toLowerCase()) {
                    cheatCodesUsed[`card-${index}`] = true;
                    found = true;
                }
            });

            if (found) {
                localStorage.setItem('cheatCodesUsed', JSON.stringify(cheatCodesUsed));
                const msg = document.getElementById('modalMessage');
                msg.style.color = 'green';
                msg.textContent = 'Чит-код прийнято!';
                setTimeout(() => location.reload(), 800);
            } else {
                const msg = document.getElementById('modalMessage');
                msg.style.color = 'red';
                msg.textContent = 'Невірний код';
            }
        });
    }

    const prev = document.getElementById('prev-page');
    if (prev) prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayPage(currentPage); } });
    const next = document.getElementById('next-page');
    if (next) next.addEventListener('click', () => { 
        const totalPages = Math.ceil(filteredCards.length / recipesPerPage);
        if (currentPage < totalPages) { currentPage++; displayPage(currentPage); } 
    });

    const search = document.getElementById('recipeSearch');
    if (search) search.addEventListener('input', filterAndSortRecipes);
    const sort = document.getElementById('recipeSort');
    if (sort) sort.addEventListener('change', filterAndSortRecipes);

    fetchUserRole().then(() => {
        loadRecipes();
    });
});

window.addEventListener("load", () => {
    const loader = document.getElementById('loader-wrapper');
    if (loader) loader.style.display = 'none';
});

