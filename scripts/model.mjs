import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {safeUrl} from '../public/assets/render.js';
export const root=path.resolve(import.meta.dirname,'..');
export const contentNames=['settings','home','about','membership','volunteer','events-page','news-page','support'];
export async function loadContent(directory=path.join(root,'content')) {
  const data={};
  for(const name of contentNames)data[name]=JSON.parse(await readFile(path.join(directory,name+'.json'),'utf8'));
  for(const collection of ['events','news']) {
    data[collection]=[];
    for(const file of (await readdir(path.join(directory,collection))).filter(f=>f.endsWith('.json')).sort()) {
      const entry=JSON.parse(await readFile(path.join(directory,collection,file),'utf8'));
      data[collection].push({...entry,id:path.basename(file,'.json')});
    }
  }
  return data;
}
export function validateContent(data) {
  const errors=[];
  for(const key of contentNames)if(!data[key]||typeof data[key]!=='object')errors.push('Missing content: '+key);
  const s=data.settings||{};
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s.email||''))errors.push('PTO email must be a valid email address');
  for(const key of ['schoolUrl','membershipUrl','storeUrl'])if(!safeUrl(s[key]))errors.push('Invalid HTTPS link: '+key);
  if(!Array.isArray(data.volunteer?.areas)||data.volunteer.areas.length<1)errors.push('At least one volunteer area is required');
  for(const name of ['home','about','membership','volunteer','events-page','news-page','support'])if(!String(data[name]?.title||'').trim())errors.push('Missing page title: '+name);
  function inspect(value,keyPath='content') {
    if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))inspect(item,keyPath+'.'+key);
    if(typeof value==='string'&&/javascript:|data:text\/html/i.test(value))errors.push('Unsafe value: '+keyPath);
  }
  inspect(data);
  for(const e of data.events||[]) {
    if(!String(e.title||'').trim()||!Number.isFinite(Date.parse(e.start)))errors.push('Event needs title and start date: '+e.id);
    if(e.end&&(!Number.isFinite(Date.parse(e.end))||Date.parse(e.end)<Date.parse(e.start)))errors.push('Event end must not be before start: '+e.id);
    if(e.link&&!safeUrl(e.link))errors.push('Event link must use HTTPS: '+e.id);
  }
  for(const n of data.news||[]) {
    if(!String(n.title||'').trim()||!Number.isFinite(Date.parse(n.date)))errors.push('Announcement needs title and date: '+n.id);
    if(n.link&&!safeUrl(n.link))errors.push('Announcement link must use HTTPS: '+n.id);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  return data;
}
