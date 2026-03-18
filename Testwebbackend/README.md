# Testwebbackend

Small QA scaffold for checking the production backend from:

- a full PHP + HTML QA dashboard (`index.php`)
- lightweight PHP helpers in `php/`

## Files

- `index.php` main QA dashboard for end-to-end browser testing
- `php/health.php` server-side proxy for `/healthz`
- `php/public-key.php` server-side proxy for `/api/v1/auth/public-key`
- `php/session-init.php` server-side secure session bootstrap
- `php/iap-login.php` redirect helper for `/api/v1/iap/complete`

## Default backend

The scaffold defaults to:

```text
https://api.pstpyst.com
```

You can override it:

- in browser: add `?backend=https://your-domain`
- in PHP: set `TESTWEBBACKEND_BASE_URL`

## Notes

- `/healthz` should work directly.
- `/api/v1/auth/public-key` should return JSON with `publicKey`.
- `index.php` is the recommended entry because it tests the real browser flow for:
  - session init
  - departments
  - forms
  - form detail
  - encrypted upload
  - validation
  - merge
  - chat
  - support email
- `/api/v1/iap/complete` should be opened through the PHP helper so login finishes on the backend domain first, the backend sets `sci_session_token`, and only then redirects back.
- If this dashboard runs on localhost, make sure backend deploy includes the local origin in `FRONTEND_EXTRA_URLS`.
- This scaffold does not replace the main frontend.
- PHP is required for the recommended QA flow because the scaffold uses PHP helpers for backend-first login and secure session bootstrap.
