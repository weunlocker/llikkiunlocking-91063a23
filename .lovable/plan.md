## Performance & Compliance Fixes

### Problem
Your homepage takes **6.8 seconds** before first content appears (FCP). Visitors on slow networks will leave before it loads. The root cause: every page (Admin, Dashboard, etc.) is downloaded on the homepage because there is no code splitting.

### Plan

1. **Lazy-load all routes** — Only download a page when the user visits it.
   - Change `App.tsx` imports from `import Dashboard from "./pages/Dashboard"` to `const Dashboard = lazy(() => import("./pages/Dashboard"))`.
   - Wrap `Routes` in a `<Suspense fallback={<LoadingSpinner />}>`.
   - This alone should cut FCP from ~7s to under 2s.

2. **Shrink the country-state-city library** — It is 2.2MB and loaded everywhere.
   - Move the import inside the component that actually needs it, or replace with a smaller subset.

3. **Add a cookie consent banner** — You display "GDPR Compliant" on the homepage but there is no consent UI.
   - A small bottom banner: "We use cookies for analytics and security." with Accept / Decline.
   - Store choice in localStorage.

4. **Add a loading skeleton for the homepage stats/services** — While services load from Supabase, show shimmer placeholders instead of empty gaps.

5. **Optional: Add Google Analytics / Plausible** — Since clients are arriving, track where they come from and which services they click.

### Expected result
- Homepage loads in under 2 seconds.
- GDPR trust badge is backed by real consent UI.
- Better conversion from visitors to registered users.

---
*Want me to implement this? Click the button above.*