const COOKIE_NAME = "auth_session";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordPBKDF2(password, salt) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(salt);
  
  const baseKey = await crypto.subtle.importKey(
    'raw', 
    passwordData, 
    { name: 'PBKDF2' }, 
    false, 
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password, userData) {
  if (userData.salt) {
    const hash = await hashPasswordPBKDF2(password, userData.salt);
    return constantTimeCompare(userData.passwordHash, hash);
  } else {
    // Legacy SHA-256
    const hash = await hashPassword(password);
    return constantTimeCompare(userData.passwordHash, hash);
  }
}

function constantTimeCompare(val1, val2) {
  if (typeof val1 !== 'string' || typeof val2 !== 'string') return false;
  if (val1.length !== val2.length) return false;
  let result = 0;
  for (let i = 0; i < val1.length; i++) {
    result |= val1.charCodeAt(i) ^ val2.charCodeAt(i);
  }
  return result === 0;
}

function getCookie(request, name) {
  const cookieString = request.headers.get("Cookie");
  if (!cookieString) return null;
  const cookies = cookieString.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return "Некоректні дані";
  if (!recipe.name || typeof recipe.name !== 'string' || recipe.name.length < 2 || recipe.name.length > 100) return "Назва має бути від 2 до 100 символів";
  if (!recipe.description || typeof recipe.description !== 'string' || recipe.description.length > 5000) return "Опис занадто довгий";
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cleanPath = url.pathname.replace(/^\/+|\/+$/g, '');

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://craftllc.pages.dev",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- API: Knowledge ---
    if (cleanPath === "api/craftai/knowledge" && request.method === "GET") {
      try {
        const githubResponse = await fetch("https://raw.githubusercontent.com/CraftLLC/CraftLLC/refs/heads/main/_worker.js");
        const githubCode = await githubResponse.text();
        
        const info = `Інформація про компанію CraftLLC:
1. Наш сайт: https://craftllc.pages.dev
2. Графік роботи підтримки: Сб-Нд 09:00-21:00, Пн-Пт 14:00-21:00.
3. Власник: Андрій Рудик (Диня псевдонім, DinyaMinecraft в Minecraft).
4. Назва компанії - CraftLLC (на честь Minecraft).
5. YouTube: https://m.youtube.com/@CraftLLCOF
6. Telegram канал: https://t.me/CraftLLC (з 3.02.2025).
7. Наші боти:
  - CraftAI (ти): @CraftLLCAIBot
  - CraftMail: @CraftMailBot
  - CraftLLC — Головний бот: @CraftLLCBot
  - CraftKeyGen: @CraftKeyGenBot
  - WordleAnswerBot: @WordleAnswerBot
  - SSSimpleMathBot: @SSSimpleMathBot
  - Блокувальник TikTok: @TikTokLinksBlockerBot
  - SimpleEchoBot: @SimpleEcho1500Bot

Більше про сайт:
На ньому є декілька сторінок:
1. Головна (https://craftllc.pages.dev/)
2. Контакти (https://craftllc.pages.dev/contacts)
3. Рецепти (https://craftllc.pages.dev/recipes)
4. Бекенд:
${githubCode}`;

        return new Response(info, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            ...corsHeaders
          }
        });
      } catch (e) {
        return new Response("Error fetching knowledge data", { status: 500, headers: corsHeaders });
      }
    }

    // --- API: Recipes ---
    // 9. Get Recipes List
    if (cleanPath === "api/recipes" && request.method === "GET") {
      try {
         const recipesStr = await env.DB.get('recipes_data');
         let recipes = recipesStr ? JSON.parse(recipesStr) : [];
         
         // If no recipes in DB, try to fallback to static file if not migrated yet? 
         // User asked to migrate list.json. If DB is empty, return empty list or handle client side.
         // Let's just return what's in DB.
         
         return new Response(JSON.stringify(recipes), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to fetch recipes" }), { status: 500, headers: corsHeaders });
      }
    }
    
    // Legacy support for 'latest' if needed (optional) but user didn't ask to remove it. 
    // Updating 'latest' logic to use DB
    if (cleanPath === "api/recipes/latest") {
      try {
        const recipesStr = await env.DB.get('recipes_data');
        const recipes = recipesStr ? JSON.parse(recipesStr) : [];
        
        if (recipes.length === 0) {
             return new Response(JSON.stringify({ error: "No recipes found" }), { status: 404, headers: corsHeaders });
        }

        const latestRecipe = recipes[0]; 
        const showBadge = url.searchParams.get("badge") === "true";

        if (showBadge) {
          return new Response(JSON.stringify({
            schemaVersion: 1,
            label: "Рецепт",
            message: latestRecipe.name,
            color: "orange"
          }), {
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }

        return new Response(JSON.stringify(latestRecipe), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Data fetch failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // --- API: Admin ---
    const ADMIN_USERNAME = "CraftLLC";

    async function isAdmin(request) {
        const token = getCookie(request, COOKIE_NAME);
        if (!token) return false;
        const username = await env.DB.get(`session:${token}`);
        return username === ADMIN_USERNAME;
    }

    // 10. Migrate/Import Recipes
    if (cleanPath === "api/admin/recipes/migrate" && request.method === "POST") {
        if (!(await isAdmin(request))) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        
        try {
            const recipes = await request.json();
            if (!Array.isArray(recipes)) {
                return new Response(JSON.stringify({ error: "Invalid format" }), { status: 400 });
            }
            await env.DB.put('recipes_data', JSON.stringify(recipes));
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
             return new Response(JSON.stringify({ error: "Migration failed" }), { status: 500 });
        }
    }

    // 11. Add Recipe
    if (cleanPath === "api/admin/recipes/add" && request.method === "POST") {
        if (!(await isAdmin(request))) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        
        try {
            const newRecipe = await request.json();
            const validationError = validateRecipe(newRecipe);
            if (validationError) return new Response(JSON.stringify({ error: validationError }), { status: 400 });

            const recipesStr = await env.DB.get('recipes_data');
            let recipes = recipesStr ? JSON.parse(recipesStr) : [];
            
            // Unshift to add to the beginning (latest)
            recipes.unshift(newRecipe);
            
            await env.DB.put('recipes_data', JSON.stringify(recipes));
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Add failed" }), { status: 500 });
        }
    }

    // 12. Edit Recipe
    if (cleanPath === "api/admin/recipes/edit" && request.method === "POST") {
        if (!(await isAdmin(request))) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        
        try {
            const { index, recipe } = await request.json();
            const validationError = validateRecipe(recipe);
            if (validationError) return new Response(JSON.stringify({ error: validationError }), { status: 400 });

            const recipesStr = await env.DB.get('recipes_data');
            let recipes = recipesStr ? JSON.parse(recipesStr) : [];
            
            if (index >= 0 && index < recipes.length) {
                recipes[index] = recipe;
                await env.DB.put('recipes_data', JSON.stringify(recipes));
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
            } else {
                return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: "Edit failed" }), { status: 500 });
        }
    }

    // 13. Delete Recipe
    if (cleanPath === "api/admin/recipes/delete" && request.method === "POST") {
        if (!(await isAdmin(request))) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
         
        try {
            const { index } = await request.json();
            const recipesStr = await env.DB.get('recipes_data');
            let recipes = recipesStr ? JSON.parse(recipesStr) : [];
            
            if (index >= 0 && index < recipes.length) {
                recipes.splice(index, 1);
                await env.DB.put('recipes_data', JSON.stringify(recipes));
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
            } else {
                return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500 });
        }
    }



    // --- API: Auth ---
    
    // 1. Register
    if (cleanPath === "api/auth/register" && request.method === "POST") {
      const { username, password, nickname } = await request.json();
      if (!username || !password || !nickname) {
        return new Response(JSON.stringify({ error: "Усі поля обов'язкові" }), { status: 400 });
      }

      const existingUser = await env.DB.get(`user:${username}`);
      if (existingUser) {
        return new Response(JSON.stringify({ error: "Користувач вже існує" }), { status: 400 });
      }

      const salt = crypto.randomUUID();
      const passwordHash = await hashPasswordPBKDF2(password, salt);
      const userData = { 
        username, 
        passwordHash, 
        salt, 
        version: 2, 
        nickname, 
        joinedAt: new Date().toISOString() 
      };
      await env.DB.put(`user:${username}`, JSON.stringify(userData));

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Login
    if (cleanPath === "api/auth/login" && request.method === "POST") {
      const { username, password } = await request.json();
      const userDataStr = await env.DB.get(`user:${username}`);
      if (!userDataStr) {
        return new Response(JSON.stringify({ error: "Невірний логін або пароль" }), { status: 401 });
      }

      const userData = JSON.parse(userDataStr);
      const isCorrect = await verifyPassword(password, userData);
      
      if (!isCorrect) {
        return new Response(JSON.stringify({ error: "Невірний логін або пароль" }), { status: 401 });
      }

      // Migration: Upgrade to PBKDF2 if legacy
      if (!userData.salt) {
        const salt = crypto.randomUUID();
        userData.passwordHash = await hashPasswordPBKDF2(password, salt);
        userData.salt = salt;
        userData.version = 2;
        await env.DB.put(`user:${username}`, JSON.stringify(userData));
      }

      const token = crypto.randomUUID();
      await env.DB.put(`session:${token}`, username, { expirationTtl: 86400 * 7 }); // 1 week

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure`
        }
      });
    }

    // 3. Me (Get Profile)
    if (cleanPath === "api/auth/me" && request.method === "GET") {
      const token = getCookie(request, COOKIE_NAME);
      if (!token) return new Response(JSON.stringify({ error: "Неавторизовано" }), { status: 401 });

      const username = await env.DB.get(`session:${token}`);
      if (!username) return new Response(JSON.stringify({ error: "Сесія закінчилася" }), { status: 401 });

      const userDataStr = await env.DB.get(`user:${username}`);
      const userData = JSON.parse(userDataStr);
      delete userData.passwordHash; // Don't return password hash

      return new Response(JSON.stringify(userData), { headers: { "Content-Type": "application/json" } });
    }

    // 4. Logout
    if (cleanPath === "api/auth/logout" && request.method === "POST") {
      const token = getCookie(request, COOKIE_NAME);
      if (token) await env.DB.delete(`session:${token}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`
        }
      });
    }

    // 5. Update Profile
    if (cleanPath === "api/auth/update" && request.method === "POST") {
      const token = getCookie(request, COOKIE_NAME);
      if (!token) return new Response(JSON.stringify({ error: "Неавторизовано" }), { status: 401 });

      const username = await env.DB.get(`session:${token}`);
      if (!username) return new Response(JSON.stringify({ error: "Сесія закінчилася" }), { status: 401 });

      const { nickname, currentPassword, newPassword } = await request.json();
      const userDataStr = await env.DB.get(`user:${username}`);
      const userData = JSON.parse(userDataStr);

      // Verify current password
      const isCorrect = await verifyPassword(currentPassword, userData);
      if (!isCorrect) {
        return new Response(JSON.stringify({ error: "Невірний поточний пароль" }), { status: 401 });
      }

      if (nickname) userData.nickname = nickname;
      if (newPassword) {
        const salt = crypto.randomUUID();
        userData.passwordHash = await hashPasswordPBKDF2(newPassword, salt);
        userData.salt = salt;
        userData.version = 2;
      }

      await env.DB.put(`user:${username}`, JSON.stringify(userData));

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 6. Delete Account
    if (cleanPath === "api/auth/delete" && request.method === "POST") {
      const token = getCookie(request, COOKIE_NAME);
      if (!token) return new Response(JSON.stringify({ error: "Неавторизовано" }), { status: 401 });

      const username = await env.DB.get(`session:${token}`);
      if (!username) return new Response(JSON.stringify({ error: "Сесія закінчилася" }), { status: 401 });

      const { password } = await request.json();
      const userDataStr = await env.DB.get(`user:${username}`);
      const userData = JSON.parse(userDataStr);

      const isCorrect = await verifyPassword(password, userData);
      if (!isCorrect) {
        return new Response(JSON.stringify({ error: "Невірний пароль" }), { status: 401 });
      }

      await env.DB.delete(`user:${username}`);
      await env.DB.delete(`session:${token}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`
        }
      });
    }

    // --- API: Likes ---
    // 7. Get Likes Data
    if (cleanPath === "api/recipes/likes-data" && request.method === "GET") {
      const token = getCookie(request, COOKIE_NAME);
      let userLikes = [];
      let isAuthenticated = false;
      
      if (token) {
        const username = await env.DB.get(`session:${token}`);
        if (username) {
           isAuthenticated = true;
           const userLikesStr = await env.DB.get(`user_likes:${username}`);
           userLikes = userLikesStr ? JSON.parse(userLikesStr) : [];
        }
      }

      const globalCountsStr = await env.DB.get('global_likes_counts');
      const counts = globalCountsStr ? JSON.parse(globalCountsStr) : {};

      return new Response(JSON.stringify({ userLikes, counts, isAuthenticated }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // 8. Toggle Like
    if (cleanPath === "api/recipes/like" && request.method === "POST") {
      const token = getCookie(request, COOKIE_NAME);
      if (!token) return new Response(JSON.stringify({ error: "Неавторизовано" }), { status: 401 });

      const username = await env.DB.get(`session:${token}`);
      if (!username) return new Response(JSON.stringify({ error: "Сесія закінчилася" }), { status: 401 });

      const { recipeName } = await request.json();
      if (!recipeName) return new Response(JSON.stringify({ error: "Не вказано назву рецепту" }), { status: 400 });

      // Update User Likes
      const userLikesStr = await env.DB.get(`user_likes:${username}`);
      let userLikes = userLikesStr ? JSON.parse(userLikesStr) : [];
      let isLiked = false;

      if (userLikes.includes(recipeName)) {
        userLikes = userLikes.filter(n => n !== recipeName);
        isLiked = false;
      } else {
        userLikes.push(recipeName);
        isLiked = true;
      }
      await env.DB.put(`user_likes:${username}`, JSON.stringify(userLikes));

      // Update Global Counts
      const globalCountsStr = await env.DB.get('global_likes_counts');
      let counts = globalCountsStr ? JSON.parse(globalCountsStr) : {};
      
      if (counts[recipeName] === undefined) counts[recipeName] = 0;
      
      if (isLiked) {
        counts[recipeName]++;
      } else {
        counts[recipeName] = Math.max(0, counts[recipeName] - 1);
      }
      
      await env.DB.put('global_likes_counts', JSON.stringify(counts));

      return new Response(JSON.stringify({ success: true, isLiked, newCount: counts[recipeName] }), {
         headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // Якщо це не API, повертаємо статичні файли
    return env.ASSETS.fetch(request);
  },
};
