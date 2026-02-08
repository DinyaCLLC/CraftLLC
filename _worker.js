const COOKIE_NAME = "auth_session";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cleanPath = url.pathname.replace(/^\/+|\/+$/g, '');

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- API: Recipes ---
    if (cleanPath === "api/recipes/latest") {
      try {
        const response = await fetch("https://craftllc.pages.dev/recipes/list.json");
        if (!response.ok) throw new Error("Failed to fetch");
        
        const recipes = await response.json();
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

      const passwordHash = await hashPassword(password);
      const userData = { username, passwordHash, nickname, joinedAt: new Date().toISOString() };
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
      const passwordHash = await hashPassword(password);
      if (userData.passwordHash !== passwordHash) {
        return new Response(JSON.stringify({ error: "Невірний логін або пароль" }), { status: 401 });
      }

      const token = crypto.randomUUID();
      await env.DB.put(`session:${token}`, username, { expirationTtl: 86400 * 7 }); // 1 week

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
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
          "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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

      // Verify current password if changing password or nickname
      const currentPasswordHash = await hashPassword(currentPassword);
      if (userData.passwordHash !== currentPasswordHash) {
        return new Response(JSON.stringify({ error: "Невірний поточний пароль" }), { status: 401 });
      }

      if (nickname) userData.nickname = nickname;
      if (newPassword) userData.passwordHash = await hashPassword(newPassword);

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

      const passwordHash = await hashPassword(password);
      if (userData.passwordHash !== passwordHash) {
        return new Response(JSON.stringify({ error: "Невірний пароль" }), { status: 401 });
      }

      await env.DB.delete(`user:${username}`);
      await env.DB.delete(`session:${token}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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
