import { createClient } from '@supabase/supabase-js';
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';

// --- Допоміжні функції ---

const jsonResponse = (data, status = 200, headers = {}) => {
  const defaultHeaders = { "Content-Type": "application/json" };
  return new Response(JSON.stringify(data), { status, headers: { ...defaultHeaders, ...headers } });
};

const getCookie = (request, name) => {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
  return cookies[name];
};

// Функція для створення Supabase клієнта з правами адміністратора
const createAdminClient = (env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are not set!");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// --- Обробник запитів ---

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApiRequest(request, env, url);
      }
      // Всі інші запити (наприклад, до /login/, /recipes/ і т.д.) будуть оброблятися Cloudflare Pages.
      // Ми повертаємо управління, щоб Pages могли віддати відповідний HTML.
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error("Critical Error:", e.message);
      return jsonResponse({ error: "Internal Server Error" }, 500);
    }
  },
};

// --- Роутер API ---

async function handleApiRequest(request, env, url) {
  const supabase = createAdminClient(env);

  // --- Реєстрація ---
  if (url.pathname === "/api/register" && request.method === "POST") {
    const { email, password, username } = await request.json();
    if (!email || !password || !username) return jsonResponse({ error: "Email, password, and username are required" }, 400);

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username,
        }
      }
    });

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ success: true, user: data.user }, 201);
  }

  // --- Вхід ---
  if (url.pathname === "/api/login" && request.method === "POST") {
    const { email, password } = await request.json();
    if (!email || !password) return jsonResponse({ error: "Email and password are required" }, 400);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return jsonResponse({ error: "Invalid credentials" }, 401);

    // Створюємо наш власний JWT для сесії в cookie
    const sessionToken = await sign({
      sub: data.user.id,
      email: data.user.email,
      username: data.user.user_metadata.username,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 1 тиждень
    }, env.JWT_SECRET);

    const headers = {
      "Set-Cookie": `auth_session=${sessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    };
    return jsonResponse({ success: true }, 200, headers);
  }

  // --- Перевірка сесії ---
  const sessionCookie = getCookie(request, "auth_session");
  let user = null;
  if (sessionCookie) {
    try {
      const isValid = await verify(sessionCookie, env.JWT_SECRET);
      if (isValid) {
        user = isValid.payload;
      }
    } catch (err) {
      // Cookie невалідний або прострочений
    }
  }

  // --- /api/me (отримання даних користувача) ---
  if (url.pathname === "/api/me" && request.method === "GET") {
    if (!user) return jsonResponse({ error: "Not authenticated" }, 401);
    return jsonResponse({ username: user.username, email: user.email });
  }

  // --- /api/logout ---
  if (url.pathname === "/api/logout" && request.method === "POST") {
    const headers = { "Set-Cookie": `auth_session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0` };
    return jsonResponse({ success: true }, 200, headers);
  }

  // --- Захищені ендпоінти ---
  if (!user) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  // --- /api/change-password ---
  if (url.pathname === "/api/change-password" && request.method === "POST") {
      const { newPassword } = await request.json();
      if (!newPassword) return jsonResponse({ error: "New password is required" }, 400);

      const { error } = await supabase.auth.admin.updateUserById(user.sub, { password: newPassword });

      if (error) return jsonResponse({ error: "Failed to update password" }, 500);
      return jsonResponse({ success: true });
  }

  // --- /api/delete-account ---
  if (url.pathname === "/api/delete-account" && request.method === "POST") {
      const { error } = await supabase.auth.admin.deleteUser(user.sub);
      if (error) return jsonResponse({ error: "Failed to delete account" }, 500);
      
      const headers = { "Set-Cookie": `auth_session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0` };
      return jsonResponse({ success: true }, 200, headers);
  }
  
  // --- API для коментарів та вподобайок ---

  const recipeCommentsMatch = url.pathname.match(/^\/api\/recipes\/(\d+)\/comments$/);
  const replyMatch = url.pathname.match(/^\/api\/comments\/(.+)\/replies$/);

  // GET /api/recipes/:id/comments - Отримати коментарі для рецепта
  if (recipeCommentsMatch && request.method === "GET") {
    const recipeId = recipeCommentsMatch[1];
    
    const { data, error } = await supabase
      .from('comments')
      .select(\`
        id,
        created_at,
        content,
        parent_id,
        user_id,
        author:users(user_metadata->username)
      \`)
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return jsonResponse({ error: "Failed to fetch comments" }, 500);
    }

    // Створюємо дерево коментарів
    const commentsById = new Map(data.map(c => [c.id, { ...c, replies: [] }]));
    const rootComments = [];

    for (const comment of commentsById.values()) {
      // Видаляємо поле, яке вже не потрібне в фінальному об'єкті
      if (comment.author && comment.author.user_metadata) {
          comment.author.username = comment.author.user_metadata.username;
          delete comment.author.user_metadata;
      }
      
      if (comment.parent_id && commentsById.has(comment.parent_id)) {
        commentsById.get(comment.parent_id).replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    }

    return jsonResponse(rootComments);
  }

  // POST /api/recipes/:id/comments - Створити новий коментар до рецепта
  if (recipeCommentsMatch && request.method === "POST") {
    const recipeId = recipeCommentsMatch[1];
    const { content } = await request.json();

    if (!content) return jsonResponse({ error: "Content is required" }, 400);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        recipe_id: recipeId,
        content: content,
        user_id: user.sub, // user.sub - це ID користувача з нашого JWT
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return jsonResponse({ error: "Failed to create comment" }, 500);
    }
    return jsonResponse(data, 201);
  }
  
  // POST /api/comments/:id/replies - Створити відповідь на коментар
  if (replyMatch && request.method === "POST") {
      const parentId = replyMatch[1];
      const { content, recipe_id } = await request.json(); // recipe_id потрібно передавати з клієнта

      if (!content || !recipe_id) return jsonResponse({ error: "Content and recipe_id are required" }, 400);

      const { data, error } = await supabase
          .from('comments')
          .insert({
              recipe_id: recipe_id,
              content: content,
              user_id: user.sub,
              parent_id: parentId,
          })
          .select()
          .single();

      if (error) {
          console.error('Error creating reply:', error);
          return jsonResponse({ error: "Failed to create reply" }, 500);
      }
      return jsonResponse(data, 201);
  }

  // POST /api/like - Поставити/зняти вподобайку
  if (url.pathname === "/api/like" && request.method === "POST") {
    const { recipe_id, comment_id } = await request.json();

    if (!recipe_id && !comment_id) {
      return jsonResponse({ error: "recipe_id or comment_id is required" }, 400);
    }

    const target = recipe_id ? { recipe_id: recipe_id } : { comment_id: comment_id };

    // 1. Перевіряємо, чи існує лайк
    const { data: existingLike, error: selectError } = await supabase
      .from('likes')
      .select('id')
      .match({ ...target, user_id: user.sub })
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 - 'not found'
        console.error("Error checking for like:", selectError);
        return jsonResponse({ error: "Database error" }, 500);
    }

    // 2. Якщо лайк існує - видаляємо його
    if (existingLike) {
      const { error: deleteError } = await supabase
        .from('likes')
        .delete()
        .match({ id: existingLike.id });

      if (deleteError) {
        console.error("Error deleting like:", deleteError);
        return jsonResponse({ error: "Failed to remove like" }, 500);
      }
      return jsonResponse({ success: true, liked: false });
    } 
    // 3. Якщо лайка немає - створюємо його
    else {
      const { error: insertError } = await supabase
        .from('likes')
        .insert({ ...target, user_id: user.sub });

      if (insertError) {
        console.error("Error inserting like:", insertError);
        return jsonResponse({ error: "Failed to add like" }, 500);
      }
      return jsonResponse({ success: true, liked: true }, 201);
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
}
