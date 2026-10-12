import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cms/oauth/worker.mjs';
const base={CMS_ORIGIN:'https://pto.example.org',AUTH_ORIGIN:'https://auth.example.org',REPOSITORY:'school/pto',ALLOWED_ADMIN_EMAILS:'owner@school.test,second@school.test',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',SESSION_SECRET:'a'.repeat(64)};
async function start(env=base){const response=await worker.fetch(new Request(env.AUTH_ORIGIN+'/auth'),env);return{cookie:response.headers.get('set-cookie').split(';')[0],target:new URL(response.headers.get('location'))};}
async function callback(session,env=base){return worker.fetch(new Request(env.AUTH_ORIGIN+'/callback?code=code&state='+session.target.searchParams.get('state'),{headers:{cookie:session.cookie}}),env);}
function provider(t,{email,verified=true,push=true,emailStatus=200}){
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.includes('/access_token'))return Response.json({access_token:'provider-token',token_type:'bearer'});
    if(url.endsWith('/user'))return Response.json({login:'different-username',email:'untrusted@example.org'});
    if(url.includes('/user/emails'))return Response.json([{email,verified,primary:false}],{status:emailStatus});
    if(url.includes('/repos/school/pto'))return Response.json({permissions:{push,admin:false}});
    throw new Error('Unexpected API request');
  });
}
test('email administrator authorization requests email-read scope',async()=>{
  const s=await start();assert.equal(s.target.searchParams.get('scope'),'public_repo user:email');
});
test('both independently verified administrator addresses grant website admin role',async t=>{
  let address='owner@school.test';
  t.mock.method(globalThis,'fetch',async url=>url.includes('/access_token')?Response.json({access_token:'provider-token',token_type:'bearer'}):url.endsWith('/user')?Response.json({login:'any-verified-account'}):url.includes('/user/emails')?Response.json([{email:address,verified:true}]):Response.json({permissions:{push:true,admin:false}}));
  for(const email of ['owner@school.test','second@school.test']){address=email;const response=await callback(await start());assert.equal(response.status,200);assert.match(await response.text(),/\\"role\\":\\"admin\\"/);}
});
test('unverified administrator address cannot gain website access',async t=>{
  provider(t,{email:'owner@school.test',verified:false});const response=await callback(await start());assert.equal(response.status,403);assert.ok(!(await response.text()).includes('provider-token'));
});
test('a different verified address is rejected even if profile email resembles an administrator',async t=>{
  provider(t,{email:'stranger@school.test'});const response=await callback(await start());assert.equal(response.status,403);
});
test('an approved email cannot edit without repository write permission',async t=>{
  provider(t,{email:'owner@school.test',push:false});const response=await callback(await start());assert.equal(response.status,403);assert.match(await response.text(),/editing permission/);
});
test('email verification permission errors fail closed',async t=>{
  provider(t,{email:'owner@school.test',emailStatus:403});const response=await callback(await start());assert.equal(response.status,403);assert.match(await response.text(),/authorize email access/);
});
test('email authorization normalizes case while retaining exact addresses',async t=>{
  provider(t,{email:' SECOND@SCHOOL.TEST '});const response=await callback(await start());assert.equal(response.status,200);
});
test('invalid administrator allowlists cannot start authentication',async()=>{
  const response=await worker.fetch(new Request(base.AUTH_ORIGIN+'/auth'),{...base,ALLOWED_ADMIN_EMAILS:'wrong-address'});assert.equal(response.status,503);
});
