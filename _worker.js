export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Нормалізуємо шлях: видаляємо зайві слеші на початку та в кінці
    // Наприклад: "//api/recipes/latest/" перетвориться на "api/recipes/latest"
    const cleanPath = url.pathname.replace(/^\/+|\/+$/g, '');

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
              "Access-Control-Allow-Origin": "*" 
            }
          });
        }

        return new Response(JSON.stringify(latestRecipe), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: "Data fetch failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Якщо це не API, повертаємо статичні файли
    return env.ASSETS.fetch(request);
  },
};