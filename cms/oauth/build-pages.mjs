import {readFile, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const publicNames = ['CMS_ORIGIN', 'AUTH_ORIGIN', 'REPOSITORY', 'PRIVATE_REPOSITORY'];
const secretNames = ['ALLOWED_ADMIN_EMAILS', 'ALLOWED_USERS', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET'];

export function readPublicSettings(toml) {
  const settings = {};
  let inVars = false;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) { inVars = line === '[vars]'; continue; }
    if (!inVars || !line || line.startsWith('#')) continue;
    const assignment = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (!assignment) continue;
    const [, name, value] = assignment;
    if (secretNames.includes(name)) throw new Error('Keep administrator allowlists and authentication secrets in Cloudflare Secret fields.');
    if (!publicNames.includes(name)) continue;
    if (Object.hasOwn(settings, name)) throw new Error('Duplicate public setting: ' + name);
    const quoted = value.match(/^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);
    if (!quoted) throw new Error(name + ' must be a quoted string in wrangler.toml.');
    settings[name] = JSON.parse(quoted[1]);
  }
  for (const name of publicNames) if (!settings[name]) throw new Error('Missing public setting: ' + name);
  for (const name of ['CMS_ORIGIN', 'AUTH_ORIGIN']) {
    const url = new URL(settings[name]);
    if (url.protocol !== 'https:' || url.origin !== settings[name]) throw new Error(name + ' must be an exact HTTPS origin without a path or trailing slash.');
  }
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(settings.REPOSITORY)) throw new Error('REPOSITORY must be owner/repository.');
  if (!['true', 'false'].includes(settings.PRIVATE_REPOSITORY)) throw new Error('PRIVATE_REPOSITORY must be the string true or false.');
  return settings;
}

export async function buildPages(outputDirectory = join(sourceDirectory, 'dist')) {
  const [toml, originalWorker] = await Promise.all([
    readFile(join(sourceDirectory, 'wrangler.toml'), 'utf8'),
    readFile(join(sourceDirectory, 'worker.mjs'), 'utf8')
  ]);
  const settings = readPublicSettings(toml);
  const exportPattern = /^export default \{/gm;
  if ([...originalWorker.matchAll(exportPattern)].length !== 1) throw new Error('Expected one Module Worker export in worker.mjs.');
  const worker = originalWorker.replace(exportPattern, 'const oauthWorker = {');
  const wrapper = `\nconst ptoPublicSettings = Object.freeze(${JSON.stringify(settings)});\nexport default {\n  fetch(request, env, context) {\n    const path = new URL(request.url).pathname;\n    if (path === '/auth' || path === '/callback') {\n      return oauthWorker.fetch(request, {...env, ...ptoPublicSettings}, context);\n    }\n    return env.ASSETS.fetch(request);\n  }\n};\n`;
  const landing = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Thrive PTO editor sign-in</title><style>body{font:18px/1.7 system-ui;background:#faf9f4;color:#173b4a;max-width:680px;margin:60px auto;padding:0 24px}a{color:#123d57}</style><h1>Thrive PTO editor sign-in</h1><p>Open the PTO editor to sign in with your approved GitHub account.</p><p><a href="' + settings.CMS_ORIGIN + '/thrive-pto/admin/">Open the PTO editor</a></p></html>';
  await rm(outputDirectory, {recursive: true, force: true});
  await mkdir(outputDirectory, {recursive: true});
  await Promise.all([
    writeFile(join(outputDirectory, '_worker.js'), worker + wrapper),
    writeFile(join(outputDirectory, '_routes.json'), JSON.stringify({version: 1, include: ['/auth', '/callback'], exclude: []}, null, 2) + '\n'),
    writeFile(join(outputDirectory, 'index.html'), landing),
    writeFile(join(outputDirectory, '404.html'), landing.replace('<h1>Thrive PTO editor sign-in</h1>', '<h1>Open the PTO editor</h1>'))
  ]);
  return {outputDirectory, settings};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildPages();
    console.log('Cloudflare Pages sign-in service built in ' + result.outputDirectory + '. Runtime secrets remain in Cloudflare.');
  } catch (error) {
    console.error('Sign-in build failed: ' + error.message);
    process.exitCode = 1;
  }
}
