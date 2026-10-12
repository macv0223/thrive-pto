# Verification and remaining setup

## Completed checks

- Fourteen automated tests passed for authoritative content, safe rendering, event ordering, Central Time display, volunteer email drafts, iCalendar exports, invalid-content rejection, OAuth PKCE/session protection, editor allowlists, repository permissions, and restoration boundaries.
- The static build produces seven public pages plus the administrator pages and a missing-page response.
- Local link/asset checks passed for 256 references in the initial website.
- Meaningful images have alternative text; navigation has a skip link, named navigation regions, visible focus states, and current-page labels.
- CSS defines desktop, tablet, narrow-screen, reduced-motion, and print behavior. Mobile navigation includes Escape handling.
- The CMS uses GitHub with editorial drafts. There is no browser-only test repository backend.
- A mocked complete OAuth provider callback was exercised, including token exchange, account checking, repository permissions, and the exact-origin popup protocol. This verifies implementation behavior without asserting that real credentials were connected.
- A restoration test exercised snapshot comparison, content-only changes, draft creation, and a race check against a newly updated main branch.

## Not yet verified live

- Live GitHub OAuth login and invited account access.
- Saving and publishing through the real GitHub repository.
- Publisher/editor separation after the administrator sets the branch ruleset.
- Real restoration draft creation and merge.
- Browser rendering and interactive phone/desktop checks; the browser QA capability was unavailable in this environment.
- External membership checkout; the supplied membership URL was retained, but automated access to that specific page was unavailable. The FutureFund store was reachable during research.
- The approved domain and its DNS/HTTPS configuration.

See `GITHUB-AND-CMS-SETUP.md` for the exact external setup and a short live verification sequence. The initial admin landing page reports its connection state accurately and does not offer a demonstration login.
