import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cms/oauth/worker.mjs';
const env={CMS_ORIGIN:'https://pto.example.org',AUTH_ORIGIN:'https://auth.example.org',REPOSITORY:'school/pto',ALLOWED_USERS:'editor,admin',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',SESSION_SECRET:'a'.repeat(64)};
async function authorize(){const response=await worker.fetch(new Request(env.AUTH_ORIGIN+'/auth?provider=github'),env);return{response,target:new URL(response.headers.get('location')),cookie:response.headers.get('set-cookie').split(';')[0]};}

test('unconfigured authentication fails closed',async()=>{assert.equal((await worker.fetch(new Request('https://auth.example.org/auth'),{})).status,503);});
test('OAuth uses PKCE, secure session cookies, and minimal public-repository scope',async()=>{
  const {response,target}=await authorize();assert.equal(response.status,302);assert.equal(target.searchParams.get('scope'),'public_repo');assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.equal(target.searchParams.get('code_challenge').length,43);
  for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(response.headers.get('set-cookie').includes(flag));
});
test('forged state and tampered cookies are denied before a token is requested',async()=>{
  const {cookie,target}=await authorize();
  assert.equal((await worker.fetch(new Request(env.AUTH_ORIGIN+'/callback?code=secret&state=wrong',{headers:{cookie}}),env)).status,403);
  assert.equal((await worker.fetch(new Request(env.AUTH_ORIGIN+'/callback?code=secret&state='+target.searchParams.get('state'),{headers:{cookie:cookie+'tamper'}}),env)).status,403);
});
test('complete provider callback checks the allowlist, repository access, and exact popup origin',async t=>{
  const {cookie,target}=await authorize();let requestCount=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    requestCount++;
    if(url==='https://github.com/login/oauth/access_token'){const body=JSON.parse(options.body);assert.equal(body.code_verifier.length,43);assert.equal(body.redirect_uri,env.AUTH_ORIGIN+'/callback');return Response.json({access_token:'provider-test-token',token_type:'bearer'});}
    if(url==='https://api.github.com/user')return Response.json({login:'editor'});
    if(url==='https://api.github.com/repos/school/pto')return Response.json({permissions:{push:true}});
    throw new Error('Unexpected provider call');
  });
  const response=await worker.fetch(new Request(env.AUTH_ORIGIN+'/callback?code=provider-code&state='+target.searchParams.get('state'),{headers:{cookie}}),env);
  assert.equal(response.status,200);assert.equal(requestCount,3);const html=await response.text();
  assert.ok(html.includes('authorization:github:success:'));assert.ok(html.includes('https://pto.example.org'));assert.ok(html.includes('event.source!==window.opener'));assert.ok(!html.includes('postMessage(payload,"*")'));
  assert.ok(!html.includes('test-secret'));assert.ok(response.headers.get('Content-Security-Policy').includes("default-src 'none'"));assert.ok(response.headers.get('set-cookie').includes('Max-Age=0'));
});
test('unapproved accounts and read-only users cannot obtain an editor token',async t=>{
  let user='outsider',push=false;
  t.mock.method(globalThis,'fetch',async url=>url.includes('/access_token')?Response.json({access_token:'provider-test-token',token_type:'bearer'}):url.endsWith('/user')?Response.json({login:user}):Response.json({permissions:{push}}));
  for(const expected of ['has not been approved','does not have PTO editing permission']){
    const {cookie,target}=await authorize();const response=await worker.fetch(new Request(env.AUTH_ORIGIN+'/callback?code=code&state='+target.searchParams.get('state'),{headers:{cookie}}),env);
    assert.equal(response.status,403);const body=await response.text();assert.match(body,new RegExp(expected));assert.ok(!body.includes('provider-test-token'));user='editor';
  }
});
