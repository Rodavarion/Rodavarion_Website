# Rodavarion TLAW 2.0 — Cloudflare Native

## Архітектура

- Website і TLAW публікуються одним Cloudflare Pages-проєктом.
- TLAW доступний за шляхом `/tlaw/`.
- Серверне API працює через Pages Functions.
- Постійні структуровані дані зберігаються у Cloudflare D1.
- GitHub `main` є джерелом production-релізу.
- Окремі Git-гілки створюють Cloudflare Preview deployments.

## Правила

1. Python/SQLite TLAW 1.x зберігається як архівна реалізація.
2. Нові серверні можливості створюються модульно у `functions/api/tlaw/`.
3. Зміни структури D1 оформлюються лише SQL-міграціями.
4. Секрети не зберігаються у Git.
5. Production оновлюється лише після перевірки preview deployment.
