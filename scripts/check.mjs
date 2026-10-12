import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {root,loadContent,validateContent} from './model.mjs';
validateContent(await loadContent());
const dist=path.join(root,'dist');
const issues=[];let links=0,pages=0;
async function walk(directory){const out=[];for(const file of await readdir(directory,{withFileTypes:true})){const full=path.join(directory,file.name);if(file.isDirectory())out.push(...await walk(full));else out.push(full);}return out;}
for(const file of (await walk(dist)).filter(f=>f.endsWith('.html'))){
  pages++;const html=await readFile(file,'utf8');
  if(!/<html\s+lang="en"/i.test(html))issues.push('Missing language: '+file);
  if(!html.includes('name="viewport"'))issues.push('Missing viewport: '+file);
  if(!/<title>[^<]+<\/title>/.test(html))issues.push('Missing title: '+file);
  if(file.endsWith('404.html'))continue;
  for(const match of html.matchAll(/<(?:a|img|script|link)[^>]+(?:href|src)="([^"]+)"/g)){
    const url=match[1];links++;
    if(/^(?:https:|mailto:|#)/.test(url))continue;
    if(/^(?:javascript:|data:|http:)/.test(url)){issues.push('Unsafe URL '+url);continue;}
    const target=path.resolve(path.dirname(file),url.split(/[?#]/)[0]);
    if(!target.startsWith(dist+path.sep))issues.push('Escapes site: '+url);
    try{const entry=await stat(target);if(entry.isDirectory())await stat(path.join(target,'index.html'));}catch{issues.push('Missing local link/asset: '+path.relative(dist,file)+' → '+url);}
  }
  for(const match of html.matchAll(/<img\b[^>]*>/g))if(!/\balt="/.test(match[0]))issues.push('Missing image description: '+file);
  if(!file.includes('/admin/')&&(!html.includes('Skip to content')||!html.includes('id="main"')))issues.push('Missing skip navigation: '+file);
}
const cms=JSON.parse(await readFile(path.join(dist,'admin/config.json'),'utf8'));
if(cms.backend.name!=='github'||cms.publish_mode!=='editorial_workflow')issues.push('CMS must use GitHub and editorial drafts');
if(cms.local_backend||cms.backend.name==='test-repo')issues.push('A test backend is forbidden in the delivered website');
if((await stat(path.join(dist,'admin/decap-cms.js'))).size<1000000)issues.push('CMS bundle missing or incomplete');
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log(JSON.stringify({html_pages:pages,local_and_external_links_checked:links,content_valid:true,editorial_cms:true}));
