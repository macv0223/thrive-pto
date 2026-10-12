# GitHub Pages and editor setup

The public site can be deployed before the final domain is approved. Editor authentication needs one small external service because GitHub Pages serves static files. This implementation uses Decap CMS, individual GitHub accounts, and the included Cloudflare OAuth Worker.

## What the administrator needs

| Item | Purpose |
| --- | --- |
| GitHub repository with `main` as its default branch | Stores the website and its content |
| Individual GitHub accounts for approved editors | Sign-in and repository editing permission |
| A Cloudflare account | Hosts the small OAuth authentication service |
| A GitHub OAuth application | Completes secure editor sign-in |
| Approved domain, when available | Replaces the temporary Pages address |

GitHub account `macv0223` was connected during this build, but the repository search did not identify an existing Thrive project. No existing repository was modified. The package is ready to upload to a new or selected repository.

## 1. Upload the project

1. Create an empty GitHub repository, for example `thrive-pto`, or select the repository intended for this project.
2. Extract the ZIP. Upload the extracted project files and folders to the repository root, preserving `.github/workflows/` and all other folders. The workflow will not work if all files are placed inside another enclosing folder.
3. Confirm the default branch is `main`. If a different publication branch is required, update the two workflow branch filters and `cms/setup.json` together.
4. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
5. Under **Actions**, run **Publish PTO website** if it did not run automatically.

Your temporary address will typically follow `https://ACCOUNT.github.io/REPOSITORY/`. The Pages action supplies the actual site URL to the build, so metadata also works for a project path and a later custom domain.

The workflows are included. They use Node.js 22 and do not need an npm installation step. `dist/` is provided as a prebuilt copy; the workflow regenerates it from editable source.

## 2. Prepare the authentication Worker

1. In Cloudflare **Workers & Pages**, create a Worker named `thrive-pto-auth`.
2. Deploy `cms/oauth/worker.mjs` as its module source. Record its assigned HTTPS address.
3. Set these Worker environment variables:

| Variable | Example or rule |
| --- | --- |
| `CMS_ORIGIN` | The exact website origin, such as `https://macv0223.github.io`; omit `/REPOSITORY/` and trailing slash |
| `AUTH_ORIGIN` | The exact assigned Worker origin, such as `https://thrive-pto-auth.ACCOUNT.workers.dev` |
| `REPOSITORY` | The exact `OWNER/REPOSITORY` name |
| `ALLOWED_USERS` | Comma-separated GitHub usernames of approved editors and administrators |
| `PRIVATE_REPOSITORY` | `false` for a public repository; `true` only if using a private repository |

The included `wrangler.toml` contains placeholder public configuration. Replace it if using the Wrangler CLI to deploy. The Cloudflare dashboard route does not require installing Wrangler.

## 3. Create the GitHub OAuth application

In the owning GitHub account's **Settings → Developer settings → OAuth Apps**, register an application:

- **Application name:** Thrive PTO editor
- **Homepage URL:** The complete deployed website URL, including its repository path if applicable
- **Authorization callback URL:** `https://YOUR-WORKER-ORIGIN/callback`

Add these values as **secret** environment variables in Cloudflare:

| Secret | Value |
| --- | --- |
| `GITHUB_CLIENT_ID` | The OAuth application's client ID |
| `GITHUB_CLIENT_SECRET` | The OAuth application's generated client secret |
| `SESSION_SECRET` | A newly generated random secret with at least 32 characters; 64 hexadecimal characters is recommended |

Do not commit secrets to GitHub or enter them into public website settings. For a public repository the OAuth application requests `public_repo`; private repositories require the broader `repo` scope. These are GitHub OAuth permissions attached to each editor's own account. The Worker separately verifies the editor allowlist and write access to the selected PTO repository.

The Worker uses PKCE, signed expiring sessions, a secure HttpOnly cookie, and an exact popup-message origin. It does not maintain a password database.

## 4. Connect the website

In the GitHub repository's **Settings → Secrets and variables → Actions → Variables**, add:

- **Name:** `CMS_OAUTH_ORIGIN`
- **Value:** The Worker's exact HTTPS origin

Run **Publish PTO website** again. The workflow automatically supplies the repository name and Pages URL to the build. You do not need to put secrets into the website or edit a YAML CMS file.

If building outside GitHub Actions, use the public values in `cms/setup.json` instead. The supplied initial values are empty so the preview accurately says sign-in is awaiting setup.

## 5. Grant editor and publisher permissions

Invite every editor individually. Editors need repository **Write** permission for Decap to create draft branches and pull requests. Include each username in the Worker `ALLOWED_USERS` list.

Configure a ruleset targeting `main` before granting editors access:

1. Enable **Restrict updates**, **Restrict deletions**, and block force pushes.
2. Require pull requests and the **check** status from **Check PTO draft**.
3. Add the designated administrator/publisher role or team to the bypass list, with **For pull requests only** where supported.
4. Keep ordinary editor accounts out of that publisher bypass list.

This allows editors to save drafts while publisher permission is enforced by GitHub's branch rules. Without these rules, anyone with repository write access may be able to publish. Available rule and team options depend on the repository owner and GitHub plan; configure and test the equivalent permission boundary offered by that account.

The custom content history tool requires repository **Admin** permission. It creates a draft restoration pull request. An administrator reviews it, marks it ready, and merges it through the normal publishing process. It restores content and uploaded images together while preserving the current application and authentication code.

## 6. Verify the connected workflow

Use a small real test announcement, then remove it after verification:

1. Sign in with an approved editor. Confirm an unapproved account is denied.
2. Edit a page and check that the draft preview changes.
3. Save a draft and confirm the live site has not changed.
4. Confirm an ordinary editor cannot merge or publish to protected `main`.
5. Publish as an administrator and wait for the Pages workflow to finish.
6. Check the resulting live page, image, navigation, and links on a phone and desktop.
7. Open content history, review the earlier revision, create a restoration draft, and confirm that creating it does not change the live website. Merge only the revision you intend to restore.

Real account sign-in, browser rendering, and real GitHub publication were not verified during initial handover. Automated provider-protocol and content-build tests passed; live testing requires the repository and OAuth setup above.

## 7. Add the approved domain

1. In GitHub **Settings → Pages → Custom domain**, add the approved hostname.
2. Add the DNS records required by GitHub for that hostname, and enable HTTPS when available.
3. Update the Worker `CMS_ORIGIN` to the exact new website origin. Update the OAuth application's homepage URL. Its callback remains the Worker `/callback` URL.
4. Run **Publish PTO website** again. The Pages action supplies the new address for canonical links and the sitemap.
5. Retest editor sign-in from the new domain. A Worker's exact origin check intentionally does not authorize old and new origins automatically.

## Services and costs

| Service | Expected cost and dependency |
| --- | --- |
| Decap CMS | Open-source; no CMS subscription required for this implementation |
| GitHub Pages | Available for public repositories on GitHub Free; private-repository availability depends on the paid plan |
| GitHub Actions | Public-repository standard runners are generally available without billed minutes; confirm the account's current plan and limits |
| Cloudflare authentication Worker | Free plan includes 100,000 requests/day and a 10 ms CPU allowance per invocation; appropriate for a small sign-in endpoint within those limits |
| Domain | Registration and renewal depend on the selected provider and name |
| FutureFund | Existing external membership/store destination; its fees and payment arrangements remain with the PTO's FutureFund setup |

The authentication service uses no paid database or object-storage binding. Costs should be confirmed against the selected accounts before launch.

## Official references

- [GitHub Pages hosting and plan availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub rulesets and available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub OAuth authorization and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Decap GitHub backend](https://decapcms.org/docs/github-backend/)
- [Decap editorial workflow](https://decapcms.org/docs/editorial-workflows/)
- [Cloudflare Worker pricing](https://developers.cloudflare.com/workers/platform/pricing/)

References checked on 12 October 2026.
