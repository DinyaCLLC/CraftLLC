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

    // --- API: Interactions ---

    // 1. Get Interaction Data
    if (cleanPath === "api/recipes/data" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("Missing id", { status: 400 });

      const likes = JSON.parse(await env.DB.get(`likes:recipe:${id}`) || "[]");
      const comments = JSON.parse(await env.DB.get(`comments:recipe:${id}`) || "[]");

      return new Response(JSON.stringify({
        likesCount: likes.length,
        liked: false, // Will be checked client-side or if token provided
        comments: comments
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // AUTH REQUIRED BELOW
    const token = getCookie(request, COOKIE_NAME);
    const currentUser = token ? await env.DB.get(`session:${token}`) : null;
    let userData = null;
    if (currentUser) {
      const userDataStr = await env.DB.get(`user:${currentUser}`);
      if (userDataStr) userData = JSON.parse(userDataStr);
    }

    // 2. Like Recipe
    if (cleanPath === "api/recipes/like" && request.method === "POST") {
      if (!userData) return new Response(JSON.stringify({ error: "Авторизуйтесь" }), { status: 401 });
      const { id } = await request.json();
      const key = `likes:recipe:${id}`;
      let likes = JSON.parse(await env.DB.get(key) || "[]");
      
      const index = likes.indexOf(userData.username);
      if (index === -1) {
        likes.push(userData.username);
      } else {
        likes.splice(index, 1);
      }
      
      await env.DB.put(key, JSON.stringify(likes));
      return new Response(JSON.stringify({ success: true, count: likes.length }));
    }

    // 3. Post Comment
    if (cleanPath === "api/recipes/comment" && request.method === "POST") {
      if (!userData) return new Response(JSON.stringify({ error: "Авторизуйтесь" }), { status: 401 });
      const { id, content } = await request.json();
      if (!content) return new Response("Content missing", { status: 400 });

      const key = `comments:recipe:${id}`;
      let comments = JSON.parse(await env.DB.get(key) || "[]");
      
      const newComment = {
        id: crypto.randomUUID(),
        username: userData.username,
        nickname: userData.nickname,
        content,
        timestamp: new Date().toISOString(),
        likes: [],
        hearts: [],
        replies: []
      };
      
      comments.unshift(newComment); // Newest first
      await env.DB.put(key, JSON.stringify(comments));
      return new Response(JSON.stringify(newComment));
    }

    // 4. Like/Heart Comment
    if (cleanPath === "api/comments/interact" && request.method === "POST") {
      if (!userData) return new Response(JSON.stringify({ error: "Авторизуйтесь" }), { status: 401 });
      const { recipeId, commentId, action } = await request.json(); // action: 'like' or 'heart'
      
      const key = `comments:recipe:${recipeId}`;
      let comments = JSON.parse(await env.DB.get(key) || "[]");
      const comment = comments.find(c => c.id === commentId);
      
      if (!comment) return new Response("Comment not found", { status: 404 });

      if (action === 'like') {
        const idx = comment.likes.indexOf(userData.username);
        if (idx === -1) comment.likes.push(userData.username);
        else comment.likes.splice(idx, 1);
      } else if (action === 'heart') {
        const canHeart = userData.role === 'admin' || userData.role === 'responder';
        if (!canHeart) return new Response("No permission", { status: 403 });
        
        const idx = comment.hearts.indexOf(userData.username);
        if (idx === -1) comment.hearts.push(userData.username);
        else comment.hearts.splice(idx, 1);
      }

      await env.DB.put(key, JSON.stringify(comments));
      return new Response(JSON.stringify({ success: true }));
    }

    // 5. Reply to Comment
    if (cleanPath === "api/comments/reply" && request.method === "POST") {
      if (!userData) return new Response(JSON.stringify({ error: "Авторизуйтесь" }), { status: 401 });
      const { recipeId, commentId, content } = await request.json();
      
      const key = `comments:recipe:${recipeId}`;
      let comments = JSON.parse(await env.DB.get(key) || "[]");
      const comment = comments.find(c => c.id === commentId);
      
      if (!comment) return new Response("Comment not found", { status: 404 });

      // Check permissions: Admin, Responder, or Author
      const isAuthor = comment.username === userData.username;
      const isAdmin = userData.role === 'admin' || userData.role === 'responder';
      
      if (!isAuthor && !isAdmin) {
        return new Response(JSON.stringify({ error: "Тільки автор або адмін можуть відповідати" }), { status: 403 });
      }

      const reply = {
        id: crypto.randomUUID(),
        username: userData.username,
        nickname: userData.nickname,
        content,
        timestamp: new Date().toISOString(),
        hearts: []
      };

      comment.replies.push(reply);
      await env.DB.put(key, JSON.stringify(comments));
      return new Response(JSON.stringify(reply));
    }

    // 6. Admin: Grant Admin Status
    if (cleanPath === "api/auth/admin-cheat" && request.method === "POST") {
      if (!userData) return new Response(JSON.stringify({ error: "Авторизуйтесь" }), { status: 401 });
      const { code } = await request.json();
      if (env.ADMIN_CODE && code === env.ADMIN_CODE) {
        userData.role = 'admin';
        await env.DB.put(`user:${userData.username}`, JSON.stringify(userData));
        return new Response(JSON.stringify({ success: true, message: "Ви тепер АДМІН!" }));
      }
      return new Response(JSON.stringify({ error: "Невірний код" }), { status: 400 });
    }

    // 7. Admin: Change User Role
    if (cleanPath === "api/admin/role" && request.method === "POST") {
      if (userData?.role !== 'admin') return new Response("No permission", { status: 403 });
      const { targetUsername, newRole } = await request.json();
      
      const targetDataStr = await env.DB.get(`user:${targetUsername}`);
      if (!targetDataStr) return new Response("User not found", { status: 404 });
      
      let targetData = JSON.parse(targetDataStr);
      targetData.role = newRole;
      await env.DB.put(`user:${targetUsername}`, JSON.stringify(targetData));
      
      return new Response(JSON.stringify({ success: true }));
    }

    // Якщо це не API, повертаємо статичні файли
    return env.ASSETS.fetch(request);
  },
};
