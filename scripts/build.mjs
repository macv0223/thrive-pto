import {mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import {root,loadContent,validateContent} from './model.mjs';
import {renderBody,pageKeys,esc,safeUrl} from '../public/assets/render.js';
import {cmsConfig} from './cms-config.mjs';

const data=validateContent(await loadContent());
const setup=JSON.parse(await readFile(path.join(root,'cms/setup.json'),'utf8'));
setup.repository=process.env.GITHUB_REPOSITORY||setup.repository;
setup.oauthOrigin=process.env.CMS_OAUTH_ORIGIN||setup.oauthOrigin;
setup.siteUrl=process.env.SITE_URL||setup.siteUrl;
const canonical=safeUrl(setup.siteUrl||process.env.PREVIEW_URL||'');
const dest=path.join(root,'dist');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
await cp(path.join(root,'public'),dest,{recursive:true});
await mkdir(path.join(dest,'data'),{recursive:true});
await writeFile(path.join(dest,'data/site.json'),JSON.stringify(data));
await writeFile(path.join(dest,'admin/config.json'),JSON.stringify(cmsConfig(setup),null,2)+'\n');
await writeFile(path.join(dest,'admin/setup-status.json'),JSON.stringify({configured:!!(setup.repository&&safeUrl(setup.oauthOrigin)),repository:setup.repository,siteUrl:canonical}));
const serial=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
for(const key of pageKeys) {
  const filename=key==='home'?'index.html':key+'.html';
  const meta=key==='events'?data['events-page']:key==='updates'?data['news-page']:data[key];
  const title=key==='home'?data.settings.name:meta.title+' | '+data.settings.shortName;
  const description=(key==='home'?data.settings.description:meta.intro||data.settings.description).replace(/\s+/g,' ').slice(0,180);
  const url=canonical?new URL(filename,canonical.replace(/\/?$/,'/')).href:'';
  const html=`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#123d57"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">${url?`<link rel="canonical" href="${esc(url)}"><meta property="og:url" content="${esc(url)}">`:''}<link rel="icon" href="./assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./assets/site.css"><script type="module" src="./assets/site.js"></script>${key==='home'?`<script type="application/ld+json">${serial({'@context':'https://schema.org','@type':'Organization',name:data.settings.name,email:data.settings.email,...(canonical?{url:canonical}:{}),logo:canonical?new URL(data.settings.logo,canonical.replace(/\/?$/,'/')).href:undefined})}</script>`:''}</head><body data-page="${key}">${renderBody(key,data)}<script id="event-data" type="application/json">${serial(data.events)}</script></body></html>\n`;
  await writeFile(path.join(dest,filename),html);
}
await writeFile(path.join(dest,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Thrive PTO</title><style>body{font:18px/1.7 system-ui;background:#faf9f4;color:#123d57;max-width:600px;margin:12vh auto;padding:30px}a{color:inherit}</style><h1>Let's get you back to the PTO.</h1><p>This page may have moved.</p><a href="${esc(canonical||'./index.html')}">Return to the Thrive PTO homepage →</a></html>`);
await writeFile(path.join(dest,'.nojekyll'),'');
await writeFile(path.join(dest,'robots.txt'),`User-agent: *\nDisallow: /admin/\n${canonical?'Sitemap: '+new URL('sitemap.xml',canonical.replace(/\/?$/,'/')).href+'\n':''}`);
if(canonical)await writeFile(path.join(dest,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageKeys.map(key=>'<url><loc>'+esc(new URL(key==='home'?'index.html':key+'.html',canonical.replace(/\/?$/,'/')).href)+'</loc></url>').join('')}</urlset>`);
console.log(JSON.stringify({pages:pageKeys.length,events:data.events.length,announcements:data.news.length,cms_configured:!!(setup.repository&&safeUrl(setup.oauthOrigin)),output:dest}));
