window.addEventListener("load", () => {
    const loader = document.getElementById('loader-wrapper');
    if (loader) loader.style.display = 'none';
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

// Додайте це десь у глобальній області видимості вашого скрипту на сторінці /recipes
window.updateRecipesDisplay = function () {
    // Ці функції вже повинні бути визначені у вашому скрипті на сторінці /recipes
    processRecipeCards();
    filterAndSortRecipes();
};

// Додайте цей слухач подій у ваш скрипт на сторінці /recipes
window.addEventListener('message', (event) => {
    // Перевірте, що повідомлення надходить з очікуваного джерела (вашої головної сторінки)
    if (event.origin !== window.location.origin) {
        console.warn('Отримано повідомлення з невідомого джерела:', event.origin);
        return;
    }

    // Обробляємо повідомлення
    if (event.data && event.data.type === 'UPDATE_RECIPES_DISPLAY') {
        console.log('Отримано команду UPDATE_RECIPES_DISPLAY від батьківської сторінки.');
        // Перезавантажуємо cheatCodesUsed з localStorage, оскільки батьківська сторінка могла його змінити
        cheatCodesUsed = JSON.parse(localStorage.getItem('cheatCodesUsed')) || {};
        // Викликаємо функції для оновлення відображення рецептів
        processRecipeCards();
        filterAndSortRecipes();
    } else if (event.data && event.data.type === 'SUBMIT_CHEAT_CODE') {
        const enteredCode = event.data.code;
        let foundMatch = false;

        document.querySelectorAll('.card').forEach((card, index) => {
            const dateAttribute = card.dataset.date;
            const cheatCodeAttribute = card.dataset.cheatcode ? card.dataset.cheatcode.toLowerCase() : null; // Convert to lowercase
            const cardId = `card-${index}`;

            if (dateAttribute && cheatCodeAttribute && enteredCode === cheatCodeAttribute) {
                const [day, month, year] = dateAttribute.split('.').map(Number);
                const releaseDate = new Date(year, month - 1, day);
                const now = new Date();

                if (now.getTime() < releaseDate.getTime()) {
                    // If date has not passed, and cheat code matches
                    cheatCodesUsed[cardId] = true; // Mark this card as bypassed
                    saveCheatCodes(); // Save updated state
                    foundMatch = true;
                }
            }
        });

        if (foundMatch) {
            processRecipeCards();
            filterAndSortRecipes();
            parent.postMessage({ type: 'CHEAT_CODE_RESULT', success: true }, '*');
        } else {
            parent.postMessage({ type: 'CHEAT_CODE_RESULT', success: false }, '*');
        }
    }
});

// Також переконайтеся, що ці функції викликаються при початковому завантаженні сторінки /recipes
document.addEventListener("DOMContentLoaded", () => {
    // Ці функції вже повинні бути визначені у вашому скрипті на сторінці /recipes
    processRecipeCards();
    filterAndSortRecipes();
});

let currentPage = 1;
let filteredCards = [];
const recipesPerPage = 5;
let countdownIntervals = {}; // Object to store intervals for each card
// Load cheat codes from localStorage or initialize empty
let cheatCodesUsed = JSON.parse(localStorage.getItem('cheatCodesUsed')) || {};

const inIframe = () => {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

// Функція для збереження активних чит-кодів у localStorage
function saveCheatCodes() {
    localStorage.setItem('cheatCodesUsed', JSON.stringify(cheatCodesUsed));
}

// Функція для розрахунку відстані Левенштейна (для пошуку)
const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
    for (let j = 1; j <= b.length; j += 1) { matrix[j][0] = j; }
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    return matrix[b.length][a.length];
};

// Функція для завантаження відео для конкретної картки
function loadVideoForCard(card) {
    const placeholder = card.querySelector('.card__vid-placeholder');
    if (placeholder) {
        const videoId = placeholder.dataset.videoid;
        if (videoId) {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('src', `https://youtube.com/embed/${videoId}?rel=0`);
            iframe.classList.add('card__vid');
            // Замінюємо плейсхолдер на iframe
            placeholder.parentNode.replaceChild(iframe, placeholder);
        }
    }
}


// Функція для відображення карток на поточній сторінці
function displayPage(page) {
    console.log("displayPage called for page:", page);
    const recipeCards = document.querySelectorAll('.card');
    console.log("Total recipe cards found in DOM (inside displayPage):", recipeCards.length);
    recipeCards.forEach(card => card.style.display = 'none');

    const startIndex = (page - 1) * recipesPerPage;
    const endIndex = startIndex + recipesPerPage;
    const pageCards = filteredCards.slice(startIndex, endIndex);
    console.log("Cards to display on current page:", pageCards.length);

    pageCards.forEach((card) => {
        card.style.display = 'block';
        // Завантажуємо відео для кожної картки, що відображається
        loadVideoForCard(card);
    });

    updatePaginationControls();
}

// Функція для оновлення елементів керування пагінацією
function updatePaginationControls() {
    console.log("updatePaginationControls called. filteredCards.length:", filteredCards.length);
    const totalPages = Math.ceil(filteredCards.length / recipesPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const searchResultsCount = document.getElementById('searchResultsCount');

    pageInfo.textContent = `Сторінка ${currentPage} з ${totalPages > 0 ? totalPages : 1}`;
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;

    searchResultsCount.textContent = `Знайдено рецептів: ${filteredCards.length}`;
    console.log("Search results count set to:", searchResultsCount.textContent);
}

// Функція для нормалізації тексту (для пошуку)
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\u0400-\u04FFa-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Функція для форматування різниці в часі з роками та місяцями
function formatCountdown(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30); // Approximation
    const days = remainingDaysAfterYears % 30;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    let parts = [];
    if (years > 0) parts.push(`<span class="value">${years}</span><span class="label">років</span>`);
    if (months > 0 || years > 0) parts.push(`<span class="value">${months}</span><span class="label">міс</span>`);
    if (days > 0 || months > 0 || years > 0) parts.push(`<span class="value">${days}</span><span class="label">днів</span>`);
    if (hours > 0 || days > 0 || months > 0 || years > 0) parts.push(`<span class="value">${hours}</span><span class="label">год</span>`);
    if (minutes > 0 || hours > 0 || days > 0 || months > 0 || years > 0) parts.push(`<span class="value">${minutes}</span><span class="label">хв</span>`);
    parts.push(`<span class="value">${seconds}</span><span class="label">с</span>`);

    // Filter out parts that are 0 if higher units are also 0
    let effectiveParts = [];
    let foundNonZero = false;
    for (let i = 0; i < parts.length; i++) {
        const valueMatch = parts[i].match(/<span class="value">(\d+)<\/span>/);
        if (valueMatch && parseInt(valueMatch[1]) > 0) {
            foundNonZero = true;
        }
        if (foundNonZero || i >= parts.length - 2) { // Always show minutes and seconds
            effectiveParts.push(parts[i]);
        }
    }

    return effectiveParts.join('');
}


// Функція для фільтрації та сортування рецептів
function filterAndSortRecipes() {
    console.log("filterAndSortRecipes called.");
    const searchInput = document.getElementById('recipeSearch');
    const sortSelect = document.getElementById('recipeSort');
    const recipeCards = document.querySelectorAll('.card');
    console.log("Recipe cards found by querySelectorAll (inside filterAndSortRecipes):", recipeCards.length);

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedType = sortSelect.value;

    const normalizedSearchTerm = normalizeText(searchTerm);

    if (normalizedSearchTerm === '') {
        // If search term is empty, consider all cards that match the selected type
        filteredCards = Array.from(recipeCards).filter(card => {
            const recipeType = card.dataset.recipetype;
            return selectedType === 'all' || recipeType === selectedType;
        });
        console.log("Filtered cards (empty search term):", filteredCards.length);
        currentPage = 1;
        displayPage(currentPage);
        return;
    }

    const queryWords = normalizedSearchTerm.split(' ').filter(w => w.length > 0);

    filteredCards = Array.from(recipeCards).filter(card => {
        const recipeType = card.dataset.recipetype;
        const matchesType = selectedType === 'all' || recipeType === selectedType;
        if (!matchesType) return false;

        const title = card.querySelector('.card__title').textContent;
        const tags = card.dataset.tags ? card.dataset.tags : '';
        const description = card.querySelector('.card__desc').textContent;

        const normalizedCardText = normalizeText(`${title} ${tags} ${description}`);
        const cardWords = normalizedCardText.split(' ').filter(w => w.length > 0);

        const blocklistedQueriesRaw = card.dataset.blocklistedqueries;
        if (blocklistedQueriesRaw) {
            const blocklistedWords = blocklistedQueriesRaw.split(',').map(w => normalizeText(w));

            const isBlocklisted = queryWords.some(qWord => blocklistedWords.includes(qWord));
            if (isBlocklisted) {
                return false;
            }
        }

        const hasMatch = queryWords.some(queryWord => {
            return cardWords.some(cardWord => {
                if (queryWord === cardWord) {
                    return true;
                }
                if (cardWord.includes(queryWord)) {
                    return true;
                }

                const distance = levenshtein(queryWord, cardWord);
                let threshold;
                if (queryWord.length <= 4) {
                    threshold = 0;
                } else if (queryWord.length <= 7) {
                    threshold = 3;
                } else {
                    threshold = 4;
                }

                if (distance <= threshold) {
                    return true;
                }
                return false;
            });
        });

        return hasMatch;
    });

    console.log("Filtered cards (with search term):", filteredCards.length);
    currentPage = 1;
    displayPage(currentPage);
}

// Функція для обробки карток на основі data-date та чит-кодів
function processRecipeCards() {
    console.log("processRecipeCards called.");
    const now = new Date();
    document.querySelectorAll('.card').forEach((card, index) => {
        const dateAttribute = card.dataset.date;
        const cheatCodeAttribute = card.dataset.cheatcode;
        const cardId = `card-${index}`; // Unique ID for each card to manage intervals

        // Clear any existing interval for this card
        if (countdownIntervals[cardId]) {
            clearInterval(countdownIntervals[cardId]);
            delete countdownIntervals[cardId];
        }

        // Check if cheat code has been successfully used for this card
        const isCheatCodeActive = cheatCodesUsed[cardId] === true;

        if (dateAttribute) {
            // Парсинг дати у форматі "dd.MM.yyyy"
            const [day, month, year] = dateAttribute.split('.').map(Number);
            // Місяці в JavaScript Date об'єкті є 0-індексованими (0-11)
            const releaseDate = new Date(year, month - 1, day);
            const timeDiff = releaseDate.getTime() - now.getTime(); // Calculate timeDiff here

            const cardVidContainer = card.querySelector('.card__vid-placeholder, .card__vid');
            const cardTitle = card.querySelector('.card__title');
            let cardDesc = card.querySelector('.card__desc');

            // If cardDesc doesn't exist, create it
            if (!cardDesc) {
                cardDesc = document.createElement('p');
                cardDesc.classList.add('card__desc');
                card.querySelector('.card__body').appendChild(cardDesc);
            }

            // Store original title and href if they exist
            if (cardTitle && !cardTitle.dataset.originalTitle) {
                cardTitle.dataset.originalTitle = cardTitle.textContent;
                cardTitle.dataset.originalHref = cardTitle.href;
            }
            // Store original description if it exists
            if (cardDesc && !cardDesc.dataset.originalDescription) {
                cardDesc.dataset.originalDescription = cardDesc.innerHTML;
            }

            // Function to update the countdown
            const updateCountdown = () => {
                const currentTime = new Date();
                const currentDiff = releaseDate.getTime() - currentTime.getTime(); // Use currentDiff inside interval

                if (currentDiff > 0 && !isCheatCodeActive) {
                    // Recipe is not yet available and cheat code is not active
                    if (cardVidContainer) cardVidContainer.style.display = 'none'; // Hide video
                    if (cardTitle) {
                        cardTitle.textContent = 'Секрет'; // Change title to "Секрет"
                        cardTitle.style.pointerEvents = 'none'; // Disable clicks
                        // cardTitle.style.cursor = 'default';
                        cardTitle.removeAttribute('href'); // Remove link
                    }
                    cardDesc.innerHTML = `Цей рецепт недоступний!<br>Він стане доступним: ${dateAttribute}<div class="card__timer">${formatCountdown(currentDiff)}</div>`;
                } else {
                    // Recipe is available or cheat code is active
                    if (cardVidContainer) cardVidContainer.style.display = 'block'; // Show video
                    if (cardTitle) {
                        const originalTitle = cardTitle.dataset.originalTitle || "Торт 'Жіночий каприз'"; // Fallback
                        cardTitle.textContent = originalTitle;
                        cardTitle.style.pointerEvents = 'auto';
                        // cardTitle.style.cursor = 'pointer';
                        cardTitle.href = cardTitle.dataset.originalHref || "https://youtu.be/8WZ-W1o2gLQ"; // Fallback
                    }
                    // Restore original description or remove timer
                    const originalDescription = cardDesc.dataset.originalDescription || ''; // Get original description
                    cardDesc.innerHTML = originalDescription;

                    // Clear the interval as the recipe is now available or bypassed
                    clearInterval(countdownIntervals[cardId]);
                    delete countdownIntervals[cardId];
                }
            };


            // Initial call to set the state
            updateCountdown();

            // Set interval to update countdown every second if not bypassed
            if (timeDiff > 0 && !isCheatCodeActive) {
                countdownIntervals[cardId] = setInterval(updateCountdown, 1000);
            }
        } else {
            // If no data-date, ensure card is visible and timer is cleared
            const cardVidContainer = card.querySelector('.card__vid-placeholder, .card__vid');
            const cardTitle = card.querySelector('.card__title');
            const cardDesc = card.querySelector('.card__desc');

            if (cardVidContainer) cardVidContainer.style.display = 'block';
            if (cardTitle) {
                const originalTitle = cardTitle.dataset.originalTitle || cardTitle.textContent;
                cardTitle.textContent = originalTitle;
                cardTitle.style.pointerEvents = 'auto';
                // cardTitle.style.cursor = 'pointer';
                cardTitle.href = cardTitle.dataset.originalHref || cardTitle.href;
            }
            if (cardDesc) {
                const originalDescription = cardDesc.dataset.originalDescription || cardDesc.innerHTML;
                cardDesc.innerHTML = originalDescription;
            }
        }
    });
}

// Функція для відображення активних чит-кодів
function renderActiveCheatCodes() {
    const activeCheatCodesList = document.getElementById('activeCheatCodesList');
    activeCheatCodesList.innerHTML = ''; // Очистити попередній список

    const allCards = document.querySelectorAll('.card');
    let hasActiveCodes = false;

    allCards.forEach((card, index) => {
        const cardId = `card-${index}`;
        const cheatCodeAttribute = card.dataset.cheatcode;
        const dateAttribute = card.dataset.date;

        // Показувати тільки якщо чит-код існує для картки І він активний І дата ще не настала природним шляхом
        if (cheatCodeAttribute && cheatCodesUsed[cardId] === true) {
            const [day, month, year] = dateAttribute.split('.').map(Number);
            const releaseDate = new Date(year, month - 1, day);
            const now = new Date();

            if (now.getTime() < releaseDate.getTime()) { // Показувати тільки якщо все ще обійдено
                hasActiveCodes = true;
                const cardTitle = card.querySelector('.card__title').dataset.originalTitle || card.querySelector('.card__title').textContent;
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('active-code-item');
                itemDiv.innerHTML = `
                <span>${cardTitle} (${cheatCodeAttribute})</span>
                <button class="remove-cheat-code-btn" data-card-id="${cardId}">Вимкнути</button>
            `;
                activeCheatCodesList.appendChild(itemDiv);
            }
        }
    });

    if (!hasActiveCodes) {
        activeCheatCodesList.innerHTML = '<p style="color: #aaa;">Немає активних чит-кодів.</p>';
    }

    // Додати обробники подій для кнопок "Вимкнути"
    activeCheatCodesList.querySelectorAll('.remove-cheat-code-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const cardIdToRemove = event.target.dataset.cardId;
            delete cheatCodesUsed[cardIdToRemove]; // Видалити активний стан
            saveCheatCodes(); // Зберегти оновлений стан
            processRecipeCards(); // Повторно обробити картки для оновлення видимості
            filterAndSortRecipes(); // Повторно відфільтрувати та відсортувати для оновлення відображення
            renderActiveCheatCodes(); // Повторно відрендерити список у модальному вікні
        });
    });
}

function generateRecipeCard(recipe, index) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.recipetype = recipe.recipe_type;
    card.dataset.tags = recipe.keywords.join(', ');
    if (recipe.excluded_queries && recipe.excluded_queries.length > 0) {
        card.dataset.blocklistedqueries = recipe.excluded_queries.join(',');
    }
    if (recipe.recipe_unchecked) {
        card.dataset.recipeunchecked = true;
    }
    if (recipe.date) {
        card.dataset.date = recipe.date;
    }
    if (recipe.cheat_code) {
        card.dataset.cheatcode = recipe.cheat_code;
    }

    let videoElement;
    if (recipe.video_id) {
        videoElement = `<div class="card__vid-placeholder" data-videoid="${recipe.video_id}"></div>`;
    } else if (recipe.video_src) {
        let src = recipe.video_src;
        if (src.startsWith('videos/') && !src.startsWith('/')) {
             src = '/recipes/' + src;
        }
        videoElement = `<video class="card__vid" src="${src}" preload controls></video>`;
    }

    let ingredientsHtml = '';
    recipe.ingredients.forEach(ingredientGroup => {
        if (ingredientGroup._name) {
            ingredientsHtml += `<br>Інградієнти для ${ingredientGroup._name}:<br>`;
        } else {
            ingredientsHtml += `<br>Інградієнти:<br>`;
        }
        for (const [name, amount] of Object.entries(ingredientGroup)) {
            if (name !== '_name') {
                ingredientsHtml += `${name} - ${amount || ''}<br>`;
            }
        }
    });

    let propertiesHtml = '';
    if (recipe.properties) {
        propertiesHtml += '<br>Властивості:<br>';
        if (recipe.properties.temperature) {
            const temp = String(recipe.properties.temperature);
            if (/^[\d-]+$/.test(temp)) {
                propertiesHtml += `Температура: ${temp}°C<br>`;
            } else {
                propertiesHtml += `Температура: ${temp}<br>`;
            }
        }
        if (recipe.properties.time) {
            propertiesHtml += `Час: ${recipe.properties.time}<br>`;
        }
        if (recipe.properties.mdiam) {
            propertiesHtml += `Діаметр: ${recipe.properties.mdiam}<br>`;
        }
    }

    let linkHref = '#';
    if (recipe.video_id) {
        linkHref = `https://youtube.com/watch?v=${recipe.video_id}`;
    } else if (recipe.video_src) {
        if (recipe.video_link) {
            linkHref = recipe.video_link;
        } else {
            let src = recipe.video_src;
            if (src.startsWith('videos/') && !src.startsWith('/')) {
                 src = '/recipes/' + src;
            }
            linkHref = src;
        }
    }

    card.innerHTML = `
    ${videoElement}
    <div class="card__body">
        <a href="${linkHref}" class="card__title" target="_blank">${recipe.name}</a>
        <p class="card__desc">
            ${recipe.description || ''}
            ${propertiesHtml}
            ${ingredientsHtml}
        </p>
        <div class="card__like-container">
            <button class="card__like-btn" aria-label="Лайкнути" data-recipe-name="${recipe.name.replace(/"/g, '&quot;')}">
                <i class="far fa-heart"></i>
            </button>
            <span class="card__like-count" data-recipe-name="${recipe.name.replace(/"/g, '&quot;')}">0</span>
        </div>
    </div>
`;

    // Add double-click event listener
    card.addEventListener('dblclick', () => {
        if (inIframe()) {
            parent.postMessage({ type: 'openCheatCodeModal' }, '*');
        } else {
            const cheatCodeModal = document.getElementById('cheatCodeModal');
            const cheatCodeInput = document.getElementById('cheatCodeInput');
            const modalMessage = document.getElementById('modalMessage');

            cheatCodeInput.value = '';
            modalMessage.textContent = '';
            cheatCodeModal.style.display = 'block';
        }
    });

    return card;
}

async function loadRecipes() {
    const response = await fetch('/api/recipes');
    let recipes = [];
    try {
        recipes = await response.json();
    } catch (e) {
        console.error("Failed to parse recipes JSON", e);
    }
    const recipesContainer = document.getElementById('recipesContainer');

    recipes.forEach((recipe, index) => {
        const card = generateRecipeCard(recipe, index);
        recipesContainer.appendChild(card);
    });

    // Initial setup after loading recipes
    processRecipeCards();
    filterAndSortRecipes();
}


document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isMainPageView = urlParams.get('mainPageView') === 'true';

    if (isMainPageView) {
        const loader = document.getElementById('loader-wrapper');
        if (loader) {
            loader.style.display = 'none';
        }
    } else {
        // If not in iframe, add the cheat code modal
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
        <!-- Cheat Code Modal -->
        <div id="cheatCodeModal" class="modal" style="display: none;">
            <div class="modal-content">
                <h2>Введіть чит-код</h2>
                <input type="text" id="cheatCodeInput" placeholder="Ваш чит-код">
                <button id="submitCheatCode">Підтвердити</button>
                <button id="cancelCheatCode">Скасувати</button>
                <p id="modalMessage" class="modal-message"></p>
            </div>
        </div>

        <!-- Active Cheat Codes Modal -->
        <div id="activeCheatCodesModal" class="modal" style="display: none;">
            <div class="modal-content">
                <h2>Активні чит-коди</h2>
                <div id="activeCheatCodesList" class="active-codes-list">
                    <!-- Active cheat codes will be rendered here -->
                </div>
                <br>
                <button id="addCheatCodeBtn">Додати чит-код</button>
                <button id="closeActiveCheatCodesModal">Закрити</button>
            </div>
        </div>
    `;
        document.body.appendChild(modalContainer);

        const submitCheatCodeBtn = document.getElementById('submitCheatCode');
        const cancelCheatCodeBtn = document.getElementById('cancelCheatCode');
        const addCheatCodeBtn = document.getElementById('addCheatCodeBtn');
        const closeActiveCheatCodesModal = document.getElementById('closeActiveCheatCodesModal');
        const cheatCodeModal = document.getElementById('cheatCodeModal');
        const activeCheatCodesModal = document.getElementById('activeCheatCodesModal');
        const cheatCodeInput = document.getElementById('cheatCodeInput');
        const modalMessage = document.getElementById('modalMessage');

        submitCheatCodeBtn.addEventListener('click', () => {
            const enteredCode = cheatCodeInput.value.trim().toLowerCase(); // Convert to lowercase
            let foundMatch = false;

            document.querySelectorAll('.card').forEach((card, index) => {
                const dateAttribute = card.dataset.date;
                const cheatCodeAttribute = card.dataset.cheatcode ? card.dataset.cheatcode.toLowerCase() : null; // Convert to lowercase
                const cardId = `card-${index}`;

                if (dateAttribute && cheatCodeAttribute && enteredCode === cheatCodeAttribute) {
                    const [day, month, year] = dateAttribute.split('.').map(Number);
                    const releaseDate = new Date(year, month - 1, day);
                    const now = new Date();

                    if (now.getTime() < releaseDate.getTime()) {
                        // If date has not passed, and cheat code matches
                        cheatCodesUsed[cardId] = true; // Mark this card as bypassed
                        saveCheatCodes(); // Save updated state
                        foundMatch = true;
                    }
                }
            });

            if (foundMatch) {
                modalMessage.style.color = 'green';
                modalMessage.textContent = 'Чит-код прийнято! Рецепт розблоковано.';
                setTimeout(() => {
                    cheatCodeModal.style.display = 'none';
                    processRecipeCards(); // Re-process cards to update visibility
                    filterAndSortRecipes(); // Re-filter and sort to update display
                }, 1500);
            } else {
                modalMessage.style.color = 'red';
                modalMessage.textContent = 'Невірний чит-код або рецепт вже доступний.';
            }
        });

        cancelCheatCodeBtn.addEventListener('click', () => {
            cheatCodeModal.style.display = 'none';
        });

        addCheatCodeBtn.addEventListener('click', () => {
            activeCheatCodesModal.style.display = 'none'; // Close active codes modal
            cheatCodeModal.style.display = 'block'; // Open cheat code input modal
            cheatCodeInput.value = '';
            modalMessage.textContent = '';
        });

        closeActiveCheatCodesModal.addEventListener('click', () => {
            activeCheatCodesModal.style.display = 'none';
        });
    }

    console.log("DOMContentLoaded event fired.");
    const searchInput = document.getElementById('recipeSearch');
    const sortSelect = document.getElementById('recipeSort');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    // Load recipes and then initialize everything
    loadRecipes().then(() => {
        searchInput.addEventListener('keyup', filterAndSortRecipes);
        sortSelect.addEventListener('change', filterAndSortRecipes);

        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayPage(currentPage);
            }
        });

        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredCards.length / recipesPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                displayPage(currentPage);
            }
        });

        setupAdminPanel();
        fetchLikes();
    });

    const isLight = urlParams.get('light') === 'true';

    async function setupAdminPanel() {
        try {
            const meRes = await fetch('/api/auth/me');
            if (meRes.status === 401) return;
            const me = await meRes.json();
            
            if (me.username !== 'CraftLLC') return;

            // Render Admin Panel
            const adminContainer = document.createElement('div');
            adminContainer.id = 'adminPanel';
            adminContainer.innerHTML = `
                <h2>Адмін Панель</h2>
                <div class="admin-controls" style="margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap;">
                    <button id="adminMigrateBtn">Імпортувати list.json</button>
                    <input type="file" id="adminMigrateInput" accept=".json" style="display: none;">
                    <button id="adminAddBtn">+ Додати рецепт</button>
                </div>
                
                <div class="db-management" style="margin-bottom: 30px; padding: 15px; background: rgba(255,165,22,0.1); border: 1px solid rgba(255,165,22,0.3); border-radius: 8px;">
                    <h4 style="margin-top: 0; margin-bottom: 10px; color: #ffa516;">Керування базою даних</h4>
                    <div style="margin-bottom: 15px; font-size: 0.9em;">
                        Статус: <strong id="dbTypeStatus">Завантаження...</strong>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button id="dbExportBtn" class="small-btn">Експорт</button>
                        <button id="dbImportBtn" class="small-btn">Імпорт</button>
                        <input type="file" id="dbImportInput" accept=".json" style="display: none;">
                        <button id="dbMigrateD1Btn" class="small-btn" style="display: none; background: #4a4a4a;">Міграція в D1</button>
                        <button id="dbSwitchBtn" class="small-btn" style="display: none; background: #ffa516; color: #141414;">Перемкнути на ...</button>
                    </div>
                </div>
                
                <div id="adminEditor" style="display: none;">
                    <h3 id="adminEditorTitle">Редагування</h3>
                    <div style="display: grid; gap: 20px; margin-bottom: 25px;">
                        <div>
                            <label>Назва</label>
                            <input id="editName" placeholder="Назва рецепту">
                        </div>
                        
                        <div>
                            <label>Опис</label>
                            <textarea id="editDesc" placeholder="Опис рецепту" rows="4"></textarea>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <label>Тип</label>
                                <input id="editType" placeholder="cookie, cake, pie, pudding">
                            </div>
                            <div>
                                <label>Дата (dd.MM.yyyy)</label>
                                <input id="editDate" placeholder="24.08.2024">
                            </div>
                        </div>

                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <label>Відео (YouTube URL або ID)</label>
                                <input id="editVideoId" placeholder="https://youtu.be/...">
                            </div>
                            <div>
                                <label>Відео (Локальне/SRC)</label>
                                <input id="editVideoSrc" placeholder="videos/cake.mp4">
                            </div>
                        </div>
                        
                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <label>Посилання на відео</label>
                                <input id="editVideoLink" placeholder="https://youtu.be/...">
                            </div>
                             <div style="display: flex; align-items: flex-end; padding-bottom: 10px;">
                                <label style="display: flex; align-items: center;">
                                    <input type="checkbox" id="editUnchecked">
                                    Неперевірений рецепт
                                </label>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <label>Температура</label>
                                <input id="editTemp" placeholder="180">
                            </div>
                            <div>
                                <label>Час</label>
                                <input id="editTime" placeholder="30хв">
                            </div>
                        </div>

                        <div>
                            <label>Інгредієнти (JSON масив об'єктів)</label>
                            <textarea id="editIngredients" rows="6" style="font-family: monospace;"></textarea>
                            <small style="color: #666; display: block; margin-top: 5px;">Приклад: [{"_name": "Тісто", "борошно": "100г"}, {"цукор": "50г"}]</small>
                        </div>
                        
                        <div>
                            <label>Ключові слова (через кому)</label>
                            <input id="editKeywords" placeholder="солодке, випічка">
                        </div>
                         
                         <div>
                            <label>Чит-код</label>
                            <input id="editCheatCode" placeholder="SECRET123">
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: flex-end;">
                        <button id="adminCancelBtn">Скасувати</button>
                        <button id="adminSaveBtn">Зберегти</button>
                    </div>
                </div>
            `;
            
            // Insert before filter controls
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                 searchContainer.parentNode.insertBefore(adminContainer, searchContainer);
            } else {
                 document.body.insertBefore(adminContainer, document.body.firstChild);
            }

            // Functionality
            const editor = document.getElementById('adminEditor');
            const editorTitle = document.getElementById('adminEditorTitle');
            
            // Form Elements
            const inpName = document.getElementById('editName');
            const inpDesc = document.getElementById('editDesc');
            const inpType = document.getElementById('editType');
            const inpVideoId = document.getElementById('editVideoId');
            const inpVideoSrc = document.getElementById('editVideoSrc'); // New
            const inpVideoLink = document.getElementById('editVideoLink'); // New
            const inpUnchecked = document.getElementById('editUnchecked'); // New
            const inpTemp = document.getElementById('editTemp');
            const inpTime = document.getElementById('editTime');
            const inpIngredients = document.getElementById('editIngredients');
            const inpKeywords = document.getElementById('editKeywords');
            const inpDate = document.getElementById('editDate');
            const inpCheatCode = document.getElementById('editCheatCode');

            let isEditing = false;
            let editingIndex = -1;
            let originalRecipe = {}; 

            document.getElementById('adminMigrateBtn').onclick = () => {
                 document.getElementById('adminMigrateInput').click();
            };

            document.getElementById('adminMigrateInput').onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        if (!confirm(`Ви впевнені, що хочете імпортувати ${Array.isArray(json) ? json.length : 0} рецептів? Це перезапише поточну базу.`)) return;

                        const res = await fetch('/api/admin/recipes/migrate', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(json)
                        });
                        
                        if (res.ok) {
                            alert('Міграція успішна!');
                            location.reload();
                        } else {
                            alert('Помилка міграції');
                        }
                    } catch (err) {
                        alert('Невалідний JSON');
                    }
                };
                reader.readAsText(file);
            };

            // DB Management Logic
            async function updateDBStatus() {
                const res = await fetch('/api/admin/db/status', { credentials: 'include' });
                if (!res.ok) return;
                const status = await res.json();
                
                const typeEl = document.getElementById('dbTypeStatus');
                const migrateBtn = document.getElementById('dbMigrateD1Btn');
                const switchBtn = document.getElementById('dbSwitchBtn');
                
                typeEl.textContent = status.type.toUpperCase() + (status.d1_available ? " (D1 доступна)" : "");
                
                if (status.d1_available) {
                    migrateBtn.style.display = 'inline-block';
                    switchBtn.style.display = 'inline-block';
                    switchBtn.textContent = status.type === 'kv' ? 'Перейти на D1' : 'Повернутись на KV';
                    switchBtn.onclick = async () => {
                        const newType = status.type === 'kv' ? 'd1' : 'kv';
                        if (!confirm(`Перемкнути базу даних на ${newType.toUpperCase()}?`)) return;
                        
                        const sRes = await fetch('/api/admin/db/switch', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ type: newType }),
                            credentials: 'include'
                        });
                        if (sRes.ok) {
                            alert('Тип БД змінено!');
                            location.reload();
                        }
                    };
                    
                    migrateBtn.onclick = async () => {
                        if (!confirm('Ви впевнені, що хочете скопіювати всі дані з KV в D1? Це перезапише існуючі дані в D1.')) return;
                        migrateBtn.disabled = true;
                        migrateBtn.textContent = 'Міграція...';
                        const mRes = await fetch('/api/admin/db/migrate', { 
                            method: 'POST',
                            credentials: 'include'
                        });
                        if (mRes.ok) {
                            alert('Дані успішно мігровано в D1!');
                        } else {
                            alert('Помилка міграції: ' + await mRes.text());
                        }
                        migrateBtn.disabled = false;
                        migrateBtn.textContent = 'Міграція в D1';
                    };
                }
            }
            updateDBStatus();

            document.getElementById('dbExportBtn').onclick = async () => {
                const btn = document.getElementById('dbExportBtn');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Експорт...';
                
                try {
                    const res = await fetch('/api/admin/db/export', {
                        credentials: 'include'
                    });
                    if (!res.ok) throw new Error('Помилка сервера: ' + res.status);
                    
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    
                    // Direct trigger
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `db_export_${new Date().toISOString().slice(0,10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    
                    // Cleanup
                    setTimeout(() => {
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }, 100);
                } catch (err) {
                    alert('Помилка при експорті: ' + err.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            };

            document.getElementById('dbImportBtn').onclick = () => {
                document.getElementById('dbImportInput').click();
            };

            document.getElementById('dbImportInput').onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        if (!confirm('Ви впевнені, що хочете імпортувати ці дані? Це перезапише поточну базу!')) return;
                        
                        const iRes = await fetch('/api/admin/db/import', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(json),
                            credentials: 'include'
                        });
                        if (iRes.ok) {
                            alert('Імпорт успішний!');
                            location.reload();
                        } else {
                            alert('Помилка імпорту');
                        }
                    } catch (err) {
                        alert('Невалідний JSON');
                    }
                };
                reader.readAsText(file);
            };

            function fillForm(recipe) {
                inpName.value = recipe.name || "";
                inpDesc.value = recipe.description || "";
                inpType.value = recipe.recipe_type || "cookie";
                inpVideoId.value = recipe.video_id || "";
                inpVideoSrc.value = recipe.video_src || "";
                inpVideoLink.value = recipe.video_link || "";
                inpUnchecked.checked = !!recipe.recipe_unchecked;
                
                if (recipe.properties) {
                     inpTemp.value = recipe.properties.temperature || "";
                     inpTime.value = recipe.properties.time || "";
                } else {
                     inpTemp.value = "";
                     inpTime.value = "";
                }

                inpIngredients.value = JSON.stringify(recipe.ingredients || [], null, 2);
                inpKeywords.value = (recipe.keywords || []).join(', ');
                inpDate.value = recipe.date || "";
                inpCheatCode.value = recipe.cheat_code || "";
            }

            function extractVideoId(input) {
                if (!input || input.trim() === "") return null;
                const trimmed = input.trim();
                
                // If it looks like a clean ID (alphanumeric, dashes, underscores, no protocol)
                if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

                try {
                    let urlObj;
                    try {
                         urlObj = new URL(trimmed);
                    } catch(e) {
                         // If new URL fails, maybe it's just 'youtube.com/...' without protocol
                         if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
                             urlObj = new URL('https://' + trimmed);
                         } else {
                             // Not a URL structure we know, treat as ID if short enough, else null
                             return trimmed.length < 20 ? trimmed : null;
                         }
                    }

                    if (urlObj.hostname.includes('youtube.com')) {
                        if (urlObj.pathname.startsWith('/embed/')) {
                             return urlObj.pathname.split('/')[2];
                        }
                        if (urlObj.searchParams.has('v')) {
                            return urlObj.searchParams.get('v');
                        }
                    } else if (urlObj.hostname.includes('youtu.be')) {
                        return urlObj.pathname.slice(1);
                    }
                } catch (e) {
                    console.error("Error parsing video URL:", e);
                }
                
                // Fallback: simple regex search for ID pattern if URL parsing logic missed it
                const match = trimmed.match(/[?&]v=([^&]+)/);
                if (match) return match[1];
                
                // Last resort: return input if it doesn't look like a full URL but wasn't caught by ID regex
                if (!trimmed.includes('/') && !trimmed.includes('.')) return trimmed;

                return null; // Can't determine ID
            }

            function getRecipeFromForm() {
                // Parse ingredients
                let ingredients = [];
                try {
                    ingredients = JSON.parse(inpIngredients.value);
                    if (!Array.isArray(ingredients)) throw new Error("Інгредієнти мають бути масивом");
                } catch(e) {
                    alert("Помилка в JSON інгредієнтів: " + e.message);
                    return null;
                }
                
                const vidId = extractVideoId(inpVideoId.value);

                return {
                    ...originalRecipe, // keep existing fields
                    name: inpName.value,
                    description: inpDesc.value,
                    recipe_type: inpType.value,
                    video_id: vidId || null,
                    video_src: inpVideoSrc.value || null,
                    video_link: inpVideoLink.value || null,
                    recipe_unchecked: inpUnchecked.checked || false,
                    properties: {
                         temperature: inpTemp.value,
                         time: inpTime.value
                    },
                    ingredients: ingredients,
                    keywords: inpKeywords.value.split(',').map(s => s.trim()).filter(s => s),
                    date: inpDate.value || null,
                    cheat_code: inpCheatCode.value || null
                };
            }

            document.getElementById('adminAddBtn').onclick = () => {
                isEditing = false;
                editingIndex = -1;
                editorTitle.textContent = "Новий рецепт";
                originalRecipe = {}; // Reset
                fillForm({
                    name: "", description: "", recipe_type: "cookie", 
                    ingredients: [ { "борошно": "100г" } ],
                    keywords: [] 
                });
                editor.style.display = 'block';
                editor.scrollIntoView({behavior: "smooth"});
            };

            document.getElementById('adminCancelBtn').onclick = () => {
                editor.style.display = 'none';
            };

            document.getElementById('adminSaveBtn').onclick = async () => {
                const recipe = getRecipeFromForm();
                if (!recipe) return;

                try {
                    let url = '/api/admin/recipes/add';
                    let body = recipe;
                    
                    if (isEditing) {
                        url = '/api/admin/recipes/edit';
                        body = { index: editingIndex, recipe };
                    }

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(body)
                    });

                    if (res.ok) {
                        alert('Збережено!');
                        location.reload();
                    } else {
                        alert('Помилка збереження');
                    }
                } catch (err) {
                    alert('Помилка: ' + err.message);
                }
            };
            
            // Add Edit/Delete buttons to each card
            const cards = document.querySelectorAll('.card');
            
            cards.forEach((card, index) => {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'admin-card-actions';
                actionsDiv.innerHTML = `
                    <button class="admin-edit-btn">Редагувати</button>
                    <button class="admin-delete-btn">Видалити</button>
                    <div class="admin-card-id">ID: ${index}</div>
                `;
                
                const editBtn = actionsDiv.querySelector('.admin-edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    e.preventDefault();

                    fetch('/api/recipes').then(r => r.json()).then(recipes => {
                         const recipe = recipes[index]; 
                         if (!recipe) {
                             alert("Не вдалося знайти рецепт");
                             return;
                         }

                         isEditing = true;
                         editingIndex = index;
                         editorTitle.textContent = `Редагування: ${recipe.name}`;
                         originalRecipe = recipe;
                         fillForm(recipe);
                         
                         editor.style.display = 'block';
                         adminContainer.scrollIntoView({ behavior: 'smooth' });
                    });
                });
                
                const deleteBtn = actionsDiv.querySelector('.admin-delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                     e.stopPropagation();
                     e.preventDefault();

                     if (confirm(`Видалити рецепт "${card.querySelector('.card__title').textContent}"?`)) {
                        const res = await fetch('/api/admin/recipes/delete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ index })
                        });
                        if (res.ok) {
                            location.reload();
                        } else {
                            alert('Помилка видалення');
                        }
                     }
                });
                
                card.querySelector('.card__body').appendChild(actionsDiv);
            });

        } catch (e) {
            console.error("Admin check failed", e);
        }
    }

    if (isLight) {
        document.body.style.background = 'none';
        document.body.style.color = 'black';
        const footer = document.getElementById("footerID");
        if (footer) {
            footer.style.background = '#aaa';
        }

        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            link.style.color = 'black';
            const linkUrl = new URL(link.href);
            if (!linkUrl.searchParams.has('light')) {
                linkUrl.searchParams.set('light', 'true');
                link.href = linkUrl.toString();
            }
        });
        const searchInputStyle = document.getElementById('recipeSearch');
        const sortSelectStyle = document.getElementById('recipeSort');
        if (searchInputStyle) {
            searchInputStyle.style.backgroundColor = '#f0f0f0';
            searchInputStyle.style.color = '#333';
        }
        if (sortSelectStyle) {
            sortSelectStyle.style.backgroundColor = '#f0f0f0';
            sortSelectStyle.style.color = '#333';
        }
    }
});


async function fetchLikes() {
    try {
        const response = await fetch('/api/recipes/likes-data');
        if (!response.ok) return;
        const data = await response.json();
        const { userLikes, counts, isAuthenticated } = data;

        const allCards = document.querySelectorAll('.card');
        


        allCards.forEach(card => {
            const btn = card.querySelector('.card__like-btn');
            const countSpan = card.querySelector('.card__like-count');
            
            if (!btn || !countSpan) return;

            let recipeName = btn.getAttribute('data-recipe-name');
            
            // Initial render
            const count = counts[recipeName] || 0;
            countSpan.textContent = count;

            if (isAuthenticated) {
                if (userLikes.includes(recipeName)) {
                    btn.classList.add('liked');
                    btn.querySelector('i').className = 'fas fa-heart';
                    btn.setAttribute('aria-label', 'Прибрати лайк');
                } else {
                    btn.classList.remove('liked');
                    btn.querySelector('i').className = 'far fa-heart';
                    btn.setAttribute('aria-label', 'Лайкнути');
                }

                // Remove old listeners to prevent duplicates if called multiple times
                // Cloning the node is a brute force way to remove listeners
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Read current state from DOM
                    const isLikedNow = newBtn.classList.contains('liked');
                    const newLikedState = !isLikedNow;
                    
                    // Optimistic UI update
                    const icon = newBtn.querySelector('i');
                    if (newLikedState) {
                        newBtn.classList.add('liked');
                        icon.className = 'fas fa-heart';
                        countSpan.textContent = parseInt(countSpan.textContent) + 1;
                        newBtn.setAttribute('aria-label', 'Прибрати лайк');
                    } else {
                        newBtn.classList.remove('liked');
                        icon.className = 'far fa-heart';
                        countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
                        newBtn.setAttribute('aria-label', 'Лайкнути');
                    }

                    try {
                        const res = await fetch('/api/recipes/like', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipeName })
                        });
                        const resData = await res.json();
                        if (resData.success) {
                            countSpan.textContent = resData.newCount;
                        } else {
                            // Revert
                            if (!newLikedState) {
                                newBtn.classList.add('liked');
                                icon.className = 'fas fa-heart';
                                countSpan.textContent = parseInt(countSpan.textContent) + 1;
                            } else {
                                newBtn.classList.remove('liked');
                                icon.className = 'far fa-heart';
                                countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
                            }
                        }
                    } catch (err) {
                        // Revert
                        if (!newLikedState) {
                            newBtn.classList.add('liked');
                            icon.className = 'fas fa-heart';
                            countSpan.textContent = parseInt(countSpan.textContent) + 1;
                        } else {
                            newBtn.classList.remove('liked');
                            icon.className = 'far fa-heart';
                            countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
                        }
                    }
                };
            } else {
                 // Not authenticated interactive check
                 const newBtn = btn.cloneNode(true);
                 btn.parentNode.replaceChild(newBtn, btn);

                 // newBtn.style.cursor = 'pointer';
                 newBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alert("Будь ласка, увійдіть в акаунт, щоб лайкати рецепти: /account");
                    // Optionally redirect: window.location.href = '/account';
                 };
            }
        });

    } catch (e) {
        console.error("Failed to fetch likes", e);
    }
}

// Clear all intervals when the page is unloaded to prevent memory leaks
window.addEventListener('beforeunload', () => {
    for (const cardId in countdownIntervals) {
        clearInterval(countdownIntervals[cardId]);
    }
});
