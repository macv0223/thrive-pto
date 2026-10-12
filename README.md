# Thrive Center for Success PTO

A responsive, accessible PTO website using the supplied logo and copy. The source is prepared for GitHub Pages; Decap CMS provides form-based editing backed by the GitHub repository. A separate Cloudflare Worker completes GitHub OAuth authentication.

## Start here

1. Open `START-HERE.html` for the handover summary.
2. Follow `docs/GITHUB-AND-CMS-SETUP.md` to activate GitHub Pages and editor accounts.
3. Give PTO editors `public/admin/editor-guide.html` or the deployed `/admin/editor-guide.html` link.

The public website is built. Live editor sign-in, saving drafts to GitHub, publishing, and restoration remain dependent on the final GitHub repository, OAuth application, Worker secrets, and publishing permissions. They are not presented as connected in the initial preview.

## Pages

- Home
- About the PTO and contact
- Upcoming events
- Volunteer opportunities with an email-based sign-up
- Family and individual membership
- Store & support
- PTO updates

There are no invented events, membership prices, board names, school policies, or testimonials. Family membership includes two household voting members; individual membership includes one, as stated in the supplied copy.

## Development

Use Node.js 22 or newer. The public build and tests have no npm dependencies.

```sh
npm test
npm run build
npm run check
```

`dist/` is the generated public website. GitHub Actions rebuilds it after content is published to `main`. Source files live under `content/` and `public/`; everyday editors use the `/admin/` interface.

## Editing and publishing

The administrator invites individual GitHub accounts with repository write access, adds their usernames to the OAuth Worker's editor allowlist, and configures a `main` ruleset so only designated administrators publish. Drafts use Decap's editorial workflow. The preview renders the same page layout used by the public site. Content history can create a restoration pull request without modifying live content.

Website editor accounts are separate from paid PTO membership. Joining on FutureFund does not grant website editing access.

## Volunteering

The sign-up form prepares a message addressed to `pto.thrive@gmail.com`. Visitors review and send it through their email app. A Copy message option provides a fallback. The website does not claim to submit messages into a database or retain volunteer details.

## Structure

```text
content/                 Editable page copy, events, and announcements
public/assets/           Website styles, JavaScript, logo, and illustrations
public/admin/            Decap CMS, editor guide, and history/restore tools
cms/oauth/               GitHub OAuth Worker and deployment configuration
cms/setup.json           Optional local deployment settings; no secrets
scripts/                 Static build, content validation, and CMS configuration
tests/                   Content, calendar, OAuth, and restoration checks
.github/workflows/       Draft checks and GitHub Pages deployment
docs/                    Setup, source credits, and verification record
dist/                    Prebuilt public website
```

See `docs/ASSET-AND-CONTENT-SOURCES.md` for source credits and placeholder replacement guidance. Decap CMS 3.16.3 is bundled locally so editor loading does not depend on a third-party script CDN. Its license and third-party notices are included.


