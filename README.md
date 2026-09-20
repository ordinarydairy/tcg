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

New card photos are JPEG-compressed before they are stored. Existing photos can be compacted, and an old Neon database can be copied in without bringing full-size blobs:

```bash
python manage.py compact_card_images
python manage.py copy_from_postgres --source "$SOURCE_DATABASE_URL"
```
