# Deployment

`render.yaml` (repo root) is a [Render Blueprint](https://render.com/docs/blueprint-spec) covering
both services on Render's free tier. This is additive: `docker compose up` still works unchanged
for local dev/demo; production just points at real Turso cloud instead of the local `sqld` container.

## One-time setup

1. Create a Turso database and auth token (your own Turso account, free tier, separate from
   Render's):
   ```
   turso db create kingofcards
   turso db tokens create kingofcards
   ```
2. In Render: **New +** → **Blueprint**, connect this repo. Render reads `render.yaml` and creates
   both services.
3. On `kingofcards-api`, fill in the env vars marked `sync: false` in `render.yaml`: `TURSO_URL` and
   `TURSO_AUTH_TOKEN` from step 1, `SENTRY_DSN` for error tracking, and (for real email delivery)
   whichever `EMAIL_TRANSPORT` you're using. `SENTRY_DSN` unset just logs errors to the service's
   console; email additionally needs `EMAIL_ENABLED` flipped to `"true"` once `SMTP_FROM` is on a
   domain you've actually verified with your provider; until then, leave it `"false"` and
   verification/reset links just log to the console instead of sending.
   - Render's free web services block outbound SMTP ports (25/465/587) entirely, so
     `EMAIL_TRANSPORT=resend_api` (with `RESEND_API_KEY`) is the transport that actually works on
     the free plan: it calls Resend's HTTPS REST API instead of connecting over SMTP.
   - `EMAIL_TRANSPORT=smtp` (with `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) only works once
     `kingofcards-api` is on a paid Render instance type, since that's what lifts the SMTP port
     block.

## Notes

- No `TURSO_AUTH_JWT_PUBLIC_KEY` here: that's specific to local `sqld`'s JWT-keypair auth in
  `docker-compose.yml`. Real Turso cloud only needs `TURSO_URL` + the token from step 1.
- `kingofcards-web` (a static site) rewrites `/trpc/*` to `kingofcards-api`'s URL, a proxy, not a
  redirect, so the browser still sees everything as same-origin. Same effect as nginx's reverse
  proxy in the Docker setup, no CORS loosening or cookie-domain change needed.
- Free-tier caveat: `kingofcards-api` (a free web service) spins down after 15 minutes idle, so the
  first request after a quiet period takes ~30-50s. The static site does not spin down.
