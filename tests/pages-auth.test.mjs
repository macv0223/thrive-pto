import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPages, readPublicSettings} from '../cms/oauth/build-pages.mjs';

const configuration = '[vars]\nCMS_ORIGIN = "https://macv0223.github.io"\nAUTH_ORIGIN = "https://thrive-pto.pages.dev"\nREPOSITORY = "macv0223/thrive-pto"\nPRIVATE_REPOSITORY = "false"\n';

test('Pages settings reject callback paths and accidental secrets in build output', () => {
  assert.throws(() => readPublicSettings(configuration.replace('https://thrive-pto.pages.dev', 'https://thrive-pto.pages.dev/callback')), /exact HTTPS origin/);
  assert.throws(() => readPublicSettings(configuration + 'GITHUB_CLIENT_SECRET = "never-bundle-this"\n'), /Cloudflare Secret fields/);
  assert.throws(() => readPublicSettings(configuration + 'ALLOWED_ADMIN_EMAILS = "owner@school.test"\n'), /Cloudflare Secret fields/);
});

test('Pages package routes authentication, keeps runtime secrets out of the bundle, and serves other assets', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'pto-pages-'));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const result = await buildPages(join(parent, 'dist'));
  const code = await readFile(join(result.outputDirectory, '_worker.js'), 'utf8');
  const routes = JSON.parse(await readFile(join(result.outputDirectory, '_routes.json'), 'utf8'));
  assert.deepEqual(routes, {version: 1, include: ['/auth', '/callback'], exclude: []});
  const pages = (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default;
  const origin = result.settings.AUTH_ORIGIN;
  assert.equal((await pages.fetch(new Request(origin + '/auth'), {})).status, 503);
  const secrets = {ALLOWED_ADMIN_EMAILS: 'owner@school.test,second@school.test', GITHUB_CLIENT_ID: 'pages-client', GITHUB_CLIENT_SECRET: 'pages-private-client-secret', SESSION_SECRET: 'a'.repeat(64)};
  assert.ok(!code.includes(secrets.GITHUB_CLIENT_SECRET));
  assert.ok(!code.includes('owner@school.test'));
  const start = await pages.fetch(new Request(origin + '/auth'), secrets);
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get('location'));
  assert.equal(target.searchParams.get('redirect_uri'), origin + '/callback');
  assert.equal(target.searchParams.get('scope'), 'public_repo user:email');
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  assert.match(start.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await pages.fetch(new Request(origin + '/callback?code=forged&state=forged'), secrets)).status, 403);
  const elsewhere = new URL(origin); elsewhere.hostname = 'unapproved.example.org';
  assert.equal((await pages.fetch(new Request(elsewhere.origin + '/auth'), secrets)).status, 400);
  let assetCalls = 0;
  const asset = await pages.fetch(new Request(origin + '/'), {ASSETS: {fetch: async () => {assetCalls++; return new Response('PTO editor link');}}});
  assert.equal(await asset.text(), 'PTO editor link');
  assert.equal(assetCalls, 1);
});

test('Pages provider callback requires a verified approved email and repository editing access', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'pto-pages-callback-'));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const result = await buildPages(join(parent, 'dist'));
  const code = await readFile(join(result.outputDirectory, '_worker.js'), 'utf8');
  const pages = (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default;
  const origin = result.settings.AUTH_ORIGIN;
  const secrets = {ALLOWED_ADMIN_EMAILS: 'owner@school.test,second@school.test', GITHUB_CLIENT_ID: 'pages-client', GITHUB_CLIENT_SECRET: 'private-secret', SESSION_SECRET: 'b'.repeat(64)};
  let email = 'owner@school.test', verified = true, push = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://github.com/login/oauth/access_token') { assert.equal(JSON.parse(options.body).redirect_uri, origin + '/callback'); return Response.json({access_token: 'pages-provider-token', token_type: 'bearer'}); }
    if (url === 'https://api.github.com/user') return Response.json({login: 'approved-person'});
    if (url.includes('/user/emails')) return Response.json([{email, verified}]);
    if (url === 'https://api.github.com/repos/' + result.settings.REPOSITORY) return Response.json({permissions: {push, admin: false}});
    throw new Error('Unexpected provider call');
  });
  async function complete() {
    const start = await pages.fetch(new Request(origin + '/auth'), secrets);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const cookie = start.headers.get('set-cookie').split(';')[0];
    return pages.fetch(new Request(origin + '/callback?code=code&state=' + state, {headers: {cookie}}), secrets);
  }
  for (const approved of ['owner@school.test', 'second@school.test']) {
    email = approved;
    const response = await complete();
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /\\"role\\":\\"admin\\"/);
    assert.ok(html.includes(result.settings.CMS_ORIGIN));
    assert.ok(!html.includes(secrets.GITHUB_CLIENT_SECRET));
  }
  verified = false; assert.equal((await complete()).status, 403);
  verified = true; push = false; assert.equal((await complete()).status, 403);
  push = true; email = 'outsider@school.test'; assert.equal((await complete()).status, 403);
});
