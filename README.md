# Noah's Storybook 🌙

A magical AI story generator for children (personalized for Noah, age 5).
6-step wizard → streaming story text + illustration → PDF download. English and Burmese.

## Architecture (Cloudflare)

- **Frontend:** Vite + React + Tailwind in `src/`. Calls only `/api/*` — the Gemini
  API key is **never** in the browser bundle.
- **Backend:** Cloudflare Pages Functions in `functions/`:
  - `POST /api/generate-story` → Server-Sent Events stream of `{ text }` chunks,
    ending with `{ done: true }` (renders live, no waiting for the full story).
  - `POST /api/generate-image` → `{ image }` (data URL).
  - Shared rate limiter in `lib/rate-limit.ts` (10 stories + 10 images per IP/hour,
    approximate per edge location).
- Runs on Cloudflare's edge: no cold starts, generous free tier.

## Local dev

```bash
npm install
npm run dev                    # frontend only: http://localhost:3000
```

To test frontend + functions together locally:

```bash
cp .env.example .dev.vars      # put your real GEMINI_API_KEY in .dev.vars
npm run pages:dev              # builds, then serves dist + functions locally
```

## Deploy to Cloudflare Pages (free)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → select the repo.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Settings → Environment Variables** → add `GEMINI_API_KEY` (Production).
   Optional: `GEMINI_TEXT_MODEL` (default `gemini-2.5-flash-lite`),
   `GEMINI_IMAGE_MODEL` (default `gemini-2.5-flash-image`).
5. **Deploy.** Every push to `main` auto-redeploys.

## Security notes

- The API key lives only in the Cloudflare environment, never in git or the client JS.
- Rate limiting: 10 stories + 10 images per IP per hour.
- For extra protection, restrict the key in Google Cloud Console
  (APIs & Services → Credentials → API restrictions → Generative Language API).
