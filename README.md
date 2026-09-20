# Tableau

Tableau is a collectible-card app for friendships that last past orientation small talk. Freshman year often starts with the same three questions—name, major, hometown—then a contact swap that never turns into another conversation. Tableau gives people something better to share: cards made from the memories that actually matter.

Each card starts as a photo and a short story. The backend grades that memory for meaning, not just how pretty the picture is, and assigns a rarity. Your collection stays private to you until you choose to meet someone, trade, or pull from the shared pack. Profiles, friends, and rooms are how those cards turn into ongoing connections instead of a one-time handshake.

The live web app is on Netlify, with the API on Railway and shared Postgres plus photo storage on Neon.

## What’s next

More card customization, matching based on the themes in people’s memories, photo and caption moderation, and opt-in privacy controls. Later: leaderboards, location-based meetups, and video as well as photos.

## Shared database (Neon)

Accounts and friends live in one Postgres database so search works across the group.

1. Install the Neon CLI, sign in, and link this repo:

```bash
npm i -g neon@latest
neon login
neon link --project-id odd-breeze-51679443 --branch production -y
neon env pull
```

Ask a project admin to add your Neon email in the Neon console if `neon link` is denied.

2. In `backend`, with the venv on, install deps and migrate (one person is enough after schema changes):

```bash
pip install -r requirements.txt
python manage.py migrate
```

Keep `.env.local` and `backend/.env` off git. `python manage.py test` still uses local SQLite.

`neon env pull` writes `DATABASE_URL` plus object-storage `AWS_*` vars. Railway should use those for production (bucket `tcg-media`). Card and profile photos are JPEG-compressed and stored in that bucket, not as Postgres blobs.

## Local run

Copy `backend/.env.example` to `backend/.env` and add a Gemini API key. Then:

```bash
cd backend && ./venv/bin/python manage.py runserver
cd frontend && npm run dev
```

The API listens on [http://127.0.0.1:8000](http://127.0.0.1:8000). The app is [http://localhost:5173](http://localhost:5173) and proxies `/api` and `/media` to Django. If 5173 is already taken, stop the extra Vite process instead of using another port.
