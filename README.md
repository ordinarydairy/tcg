# tableau

## Shared database (Neon)

Accounts and friends live in one Postgres database so search works across the group.

1. Install the Neon CLI, sign in, and link this repo:

```bash
npm i -g neon@latest
neon login
neon link --project-id odd-breeze-51679443 --branch production -y
```

Ask a project admin to add your Neon email in the Neon console if `neon link` is denied.

2. In `backend`, with the venv on, install deps and migrate (one person is enough after schema changes):

```bash
pip install -r requirements.txt
python manage.py migrate
```

Keep `.env.local` and `backend/.env` off git. `python manage.py test` still uses local SQLite.

`neon env pull` writes `DATABASE_URL` plus object-storage `AWS_*` vars. Railway should use those for production (bucket `tcg-media`). New card photos are JPEG-compressed; when object storage is configured they are not also stored as Postgres blobs.

To copy an older Neon database after it accepts connections:

```bash
python manage.py compact_card_images
python manage.py copy_from_postgres --source "$SOURCE_DATABASE_URL"
```
