# tcg

## Shared database (Neon)

Accounts and friends live in one Postgres database so search works across the group.

1. Install the Neon CLI, sign in, and link this repo:

```bash
npm i -g neon@latest
neon login
neon link --project-id small-violet-65206938 --branch production -y
```

Ask a project admin to add your Neon email in the Neon console if `neon link` is denied.

2. In `backend`, with the venv on, install deps and migrate (one person is enough after schema changes):

```bash
pip install -r requirements.txt
python manage.py migrate
```

Keep `.env.local` and `backend/.env` off git. `python manage.py test` still uses local SQLite.