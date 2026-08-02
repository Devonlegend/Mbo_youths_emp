# RMHCDT Youth Portal — Issues Summary

Quick summary of what's been found, what's already fixed on the frontend, and what still needs your attention on the backend/hosting side.

---

## 1. Logout doesn't actually log out (needs your fix)

**What happens:** On the live site, clicking "Sign out" redirects to `/dashboard` instead of staying on `/login`. Works fine locally, only breaks in production.

**Likely cause:** The cookies are cleared on logout, but not with the same `secure`/`samesite` settings they were originally set with. Since frontend and backend are on different domains in production, a mismatch here means the browser doesn't actually clear the cookie — so the user still looks "logged in" on the next check.

**Where to look:** the cookie-clearing logic in `views.py` (the function that clears `access_token` / `refresh_token` on logout) — compare it against the function that originally sets those cookies on login, and make sure both use matching settings.

---

## 2. Mobile login fails (fix ready on frontend, one thing needed from you)

**What happens:** Logging in on mobile (tested on iPhone Safari) fails right after entering the OTP — the app says "Authentication credentials were not provided," even though the code was correct. Desktop works fine.

**Cause:** Frontend and backend are hosted on two separate domains. Mobile Safari blocks cookies across separate sites more aggressively than desktop browsers, so the login cookie never actually gets saved on the phone.

**What's already done:** Added a proxy layer to the Next.js app so all API calls now go through the frontend's own domain instead of calling the backend directly. This makes the cookie same-site again, which should resolve the mobile issue. Tested and confirmed working locally.

**What you need to do:** add one environment variable to the **frontend** service on Render:

```
BACKEND_URL=https://backend-q04n.onrender.com
```

Then redeploy the frontend (Render may do this automatically after the variable is added).

---

## 3. Admin page briefly flashed before redirecting (already fixed, no action needed)

Logged-in students visiting `/admin` briefly saw the admin page before being redirected to `/dashboard`. This was a frontend timing issue and has already been fixed — nothing needed from you here.


## Summary

| Issue | Needs from you |
|---|---|
| Logout doesn't clear session | Fix the cookie-clearing logic in `views.py` to match the cookie-setting logic |
| Mobile login fails | Add `BACKEND_URL` env var to the frontend service on Render, redeploy |
| Admin page flash | Nothing — already fixed |
| Migration drift | Just double check production database is in sync |

Once the two items above are done, we'll retest together: desktop login/logout first, then mobile.