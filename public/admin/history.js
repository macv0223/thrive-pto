import {githubClient,prepareRestoration,createRestorationDraft} from './history-api.js';
import {renderBody} from '../assets/render.js';
const status=document.querySelector('#history-status'),login=document.querySelector('#history-login');
let config,api,plan,token,earlierData,assetUrls=[];
const message=text=>{status.textContent=text;};
try{
  const state=await fetch('setup-status.json',{cache:'no-store'}).then(r=>r.json());
  config=await fetch('config.json',{cache:'no-store'}).then(r=>r.json());
  if(!state.configured)message('Content history will be available after your administrator connects editing access.');
  else{message('Sign in with an approved repository administrator account to see content history.');login.hidden=false;}
}catch{message('The editor connection is unavailable. Please reload the page.');}
login.addEventListener('click',()=>{
  const origin=new URL(config.backend.base_url).origin;
  const popup=window.open(origin+'/auth?provider=github','thrive-editor-auth','width=650,height=720');
  if(!popup){message('Please allow the sign-in popup and try again.');return;}
  login.disabled=true;message('Complete sign-in in the GitHub window.');
  const finish=()=>{window.removeEventListener('message',receive);clearInterval(closed);login.disabled=false;};
  async function receive(event){
    if(event.origin!==origin||event.source!==popup||typeof event.data!=='string')return;
    if(event.data==='authorizing:github'){popup.postMessage(event.data,origin);return;}
    const prefix='authorization:github:success:';if(!event.data.startsWith(prefix))return;
    finish();
    try{token=JSON.parse(event.data.slice(prefix.length)).token;if(!token)throw new Error('Sign-in did not return an editor token.');api=githubClient(config.backend.repo,token);const repo=await api('');if(!repo.permissions?.admin)throw new Error('Content restoration requires a repository administrator account.');await loadHistory();login.hidden=true;document.querySelector('#history-logout').hidden=false;}
    catch(error){token=undefined;api=undefined;message(error.message);}
  }
  window.addEventListener('message',receive);
  const closed=setInterval(()=>{if(popup.closed){finish();if(!token)message('Sign-in closed. You can try again.');}},500);
});
document.querySelector('#history-logout').addEventListener('click',()=>{token=undefined;api=undefined;plan=undefined;document.querySelector('#history-list').replaceChildren();document.querySelector('#restore-review').hidden=true;document.querySelector('#history-logout').hidden=true;login.hidden=false;message('Signed out of content history.');});
async function loadHistory(){
  message('Loading the most recent 30 content revisions…');
  const commits=await api('/commits?sha='+encodeURIComponent(config.backend.branch)+'&path=content&per_page=30');
  const container=document.querySelector('#history-list');container.replaceChildren();
  for(const revision of commits){
    const row=document.createElement('article');row.className='history-entry';
    const copy=document.createElement('div'),title=document.createElement('strong'),date=document.createElement('p'),button=document.createElement('button');
    title.textContent=revision.commit.message.split('\n')[0];date.textContent=new Date(revision.commit.committer.date).toLocaleString()+' · '+revision.sha.slice(0,7);copy.append(title,date);
    button.textContent='Review this version';button.addEventListener('click',()=>review(revision.sha));row.append(copy,button);container.append(row);
  }
  message('Select a revision to review. Nothing is published when you select a version.');
}
async function review(revision){
  try{
    message('Comparing this version with the live content…');
    plan=await prepareRestoration(api,revision,config.backend.branch);
    const list=document.querySelector('#restore-changes');list.replaceChildren();
    const labels={'settings':'Site settings and links','home':'Home page','about':'About page','membership':'Membership page','volunteer':'Volunteer page','events-page':'Events page','news-page':'Updates page','support':'Store & support page'};
    for(const change of plan.changes){const li=document.createElement('li');const name=change.path.split('/').at(-1).replace(/\.json$/,'');li.textContent=(change.sha?'Restore ':'Remove ')+(labels[name]||((change.path.includes('/uploads/')?'Uploaded image: ':change.path.includes('/events/')?'Event: ':'Announcement: ')+name));list.append(li);}
    if(Object.keys(labels).some(name=>!plan.files.some(file=>file.path==='content/'+name+'.json')))throw new Error('This revision predates the complete PTO website. Please choose a newer revision.');
    earlierData={events:[],news:[]};
    const records=await Promise.all(plan.files.filter(file=>file.path.startsWith('content/')).map(async file=>({file,blob:await api('/git/blobs/'+file.sha)})));
    for(const {file,blob} of records){const value=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));const key=file.path.split('/').at(-1).replace(/\.json$/,'');if(file.path.startsWith('content/events/'))earlierData.events.push({...value,id:key});else if(file.path.startsWith('content/news/'))earlierData.news.push({...value,id:key});else earlierData[key]=value;}
    for(const url of assetUrls)URL.revokeObjectURL(url);assetUrls=[];
    for(const record of [earlierData.settings,earlierData.home,...earlierData.news])for(const field of ['logo','image'])if(record?.[field]){
      const found=plan.files.find(file=>file.path==='public/'+record[field].replace(/^\/+/,''));if(!found)continue;
      const blob=await api('/git/blobs/'+found.sha);const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));const extension=found.path.split('.').at(-1).toLowerCase();const mime=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml'})[extension]||'application/octet-stream';const url=URL.createObjectURL(new Blob([bytes],{type:mime}));assetUrls.push(url);record[field]=url;
    }
    renderEarlier();
    document.querySelector('#restore-review').hidden=false;document.querySelector('#restore-draft').disabled=!plan.changes.length;document.querySelector('#restore-result').replaceChildren();
    message(plan.changes.length?plan.changes.length+' content files or images will change if this restoration is published.':'This version already matches the live content.');
    document.querySelector('#restore-review').scrollIntoView({block:'start'});
  }catch(error){message(error.message);}
}
function renderEarlier(){if(!earlierData)return;const base=new URL('../',location.href).href;document.querySelector('#restore-preview').srcdoc=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}assets/site.css"><body>${renderBody(document.querySelector('#history-preview-page').value,earlierData,{base,preview:true})}</body></html>`;}
document.querySelector('#history-preview-page').addEventListener('change',renderEarlier);
document.querySelector('#restore-draft').addEventListener('click',async()=>{
  const button=document.querySelector('#restore-draft');button.disabled=true;
  try{const draft=await createRestorationDraft(api,plan);const link=document.createElement('a');link.href=draft.html_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Review and publish the restoration draft in GitHub →';document.querySelector('#restore-result').replaceChildren(link);message('Restoration draft created. Review it, mark it ready, and merge it in GitHub to publish. The live website has not changed.');}
  catch(error){message(error.message);button.disabled=false;}
});
