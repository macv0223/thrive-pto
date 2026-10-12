import test from 'node:test';
import assert from 'node:assert/strict';
import {contentPath,prepareRestoration,createRestorationDraft} from '../public/admin/history-api.js';
test('restoration only includes approved content and uploads, never application code or authentication',()=>{
  for(const p of ['content/home.json','content/events/2026-event.json','public/assets/uploads/photo.webp'])assert.equal(contentPath(p),true);
  for(const p of ['cms/oauth/worker.mjs','.github/workflows/pages.yml','content/../secret.json','public/assets/uploads/../secret','public/assets/site.js'])assert.equal(contentPath(p),false);
});
test('restore reviews a real snapshot, creates a separate draft, and leaves main unchanged',async()=>{
  const old='a'.repeat(40),current='b'.repeat(40),calls=[];
  const api=async(endpoint,options)=>{
    calls.push({endpoint,options});
    if(endpoint==='/git/ref/heads/main')return{object:{sha:current}};
    if(endpoint==='/git/commits/'+old)return{tree:{sha:'oldtree'}};
    if(endpoint==='/git/commits/'+current)return{tree:{sha:'currenttree'}};
    if(endpoint.includes('trees/currenttree'))return{tree:[{path:'content/home.json',type:'blob',sha:'newcopy'},{path:'content/news/new.json',type:'blob',sha:'newnews'},{path:'cms/oauth/worker.mjs',type:'blob',sha:'currentcode'}]};
    if(endpoint.includes('trees/oldtree'))return{tree:[{path:'content/home.json',type:'blob',sha:'oldcopy'},{path:'cms/oauth/worker.mjs',type:'blob',sha:'oldcode'}]};
    if(endpoint==='/git/trees')return{sha:'restoredtree'};
    if(endpoint==='/git/commits')return{sha:'draftcommit'};
    if(endpoint==='/git/refs')return{};
    if(endpoint==='/pulls')return{html_url:'https://github.com/school/pto/pull/1'};
    throw new Error(endpoint);
  };
  const plan=await prepareRestoration(api,old);assert.equal(plan.changes.length,2);assert.equal(plan.changes[1].sha,null);
  await createRestorationDraft(api,plan);
  const pull=calls.find(c=>c.endpoint==='/pulls');assert.equal(pull.options.body.draft,true);assert.equal(pull.options.body.base,'main');assert.match(pull.options.body.head,/^restore\/content-/);
  assert.ok(calls.every(c=>c.options?.method!=='PATCH'));
});
test('publication races prevent restoring against a stale main revision',async()=>{
  await assert.rejects(createRestorationDraft(async()=>({object:{sha:'changed'}}),{branch:'main',base:'old',changes:[{path:'content/home.json',sha:'blob'}]}),/New changes were published/);
});
