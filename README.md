# BookMosh

BookMosh is the book tracker experience running at [bookmosh.com](https://bookmosh.com). It uses Open Library for discovery, Supabase for persistence, and Vercel for continuous deployment. This README captures how to run it locally and how to wire up Supabase before pushing to production.

## Local development

1. `npm install`
2. Copy `.env.example` → `.env`
3. Fill in the Supabase variables (see the next section)
4. Run `npm run dev` and open http://localhost:5173
5. Export Goodreads CSV / StoryGraph JSON files to test the Import panel.

## Supabase setup

The project uses Supabase to persist tracked books per account. After you create a Supabase project:

1. Enable a table called `bookmosh_books` with columns:
   - `id` (UUID, default `gen_random_uuid()`, primary key)
   - `owner` (text, NOT NULL)
   - `title` (text, NOT NULL)
   - `author` (text, NOT NULL)
   - `status` (text, NOT NULL)
   - `progress` (integer, default 0)
   - `mood` (text)
   - `rating` (numeric)
   - `updated_at` (timestamp with time zone, default `now()`)  
   Add a unique constraint on `owner` + `title`, or a primary key that covers both fields.

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
