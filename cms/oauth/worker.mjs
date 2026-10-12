const encoder=new TextEncoder();
const cookieName='__Host-thrive-oauth';
const baseHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const cookie=(value,age=600)=>`${cookieName}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const error=(message,status=400,clear=true)=>new Response(message,{status,headers:{...baseHeaders,'Content-Type':'text/plain;charset=utf-8',...(clear?{'Set-Cookie':cookie('',0)}:{})}});
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function signSession(data,secret){const payload=b64(encoder.encode(JSON.stringify(data)));const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload));return payload+'.'+b64(new Uint8Array(signature));}
async function readSession(value,secret){
  if(!value||value.length>3000)return null;
  try{
    const [payload,signature,extra]=value.split('.');if(extra||!signature)return null;
    if(!await crypto.subtle.verify('HMAC',await key(secret),unb64(signature),encoder.encode(payload)))return null;
    const result=JSON.parse(new TextDecoder().decode(unb64(payload)));
    if(!result.state||!result.verifier||!Number.isFinite(result.created)||Date.now()-result.created>600000||result.created>Date.now()+1000)return null;
    return result;
  }catch{return null;}
}
function config(env){
  const cms=new URL(env.CMS_ORIGIN||'');const auth=new URL(env.AUTH_ORIGIN||'');
  if(cms.protocol!=='https:'||auth.protocol!=='https:'||cms.origin!==env.CMS_ORIGIN||auth.origin!==env.AUTH_ORIGIN)throw new Error('Origins must be exact HTTPS origins');
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(env.REPOSITORY||''))throw new Error('Repository required');
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||String(env.SESSION_SECRET||'').length<32)throw new Error('Secrets required');
  const users=String(env.ALLOWED_USERS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const adminEmails=String(env.ALLOWED_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(adminEmails.some(email=>! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))throw new Error('Administrator emails must be valid');
  if(!users.length&&!adminEmails.length)throw new Error('Editor allowlist required');
  const repoScope=env.PRIVATE_REPOSITORY==='true'?'repo':'public_repo';
  return{cms:cms.origin,auth:auth.origin,users,adminEmails,scope:repoScope+(adminEmails.length?' user:email':'')};
}
function authorizedPopup(token,origin,role){
  const nonce=random();
  const payload='authorization:github:success:'+JSON.stringify({token,provider:'github',role});
  const source=`const origin=${json(origin)},payload=${json(payload)};if(window.opener){const timer=setTimeout(()=>{document.getElementById('message').textContent='Return to the editor and try signing in again.'},30000);function receive(event){if(event.origin!==origin||event.source!==window.opener||event.data!=='authorizing:github')return;clearTimeout(timer);window.removeEventListener('message',receive);window.opener.postMessage(payload,origin);setTimeout(()=>window.close(),250)}window.addEventListener('message',receive);window.opener.postMessage('authorizing:github',origin)}else{document.getElementById('message').textContent='Return to the PTO editor and sign in there.'}`;
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thrive PTO editor sign-in</title><style nonce="${nonce}">body{font:18px/1.7 system-ui;color:#123d57;background:#faf9f4;padding:40px;max-width:650px;margin:auto}</style></head><body><h1>You're connected.</h1><p id="message">Returning to the PTO editor…</p><script nonce="${nonce}">${source}</script></body></html>`,{headers:{...baseHeaders,'Content-Type':'text/html;charset=utf-8','Set-Cookie':cookie('',0),'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}});
}

export default {
  async fetch(request,env) {
    let settings;
    try{settings=config(env);}catch{return error('PTO editor authentication has not been configured.',503,false);}
    const url=new URL(request.url);
    if(url.origin!==settings.auth)return error('Unexpected authentication host.',400,false);
    if(request.method!=='GET')return error('Method not allowed.',405,false);
    if(url.pathname==='/auth') {
      const provider=url.searchParams.get('provider');if(provider&&provider!=='github')return error('Unsupported sign-in provider.');
      const session={state:random(),verifier:random(),created:Date.now()};
      const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(session.verifier))));
      const target=new URL('https://github.com/login/oauth/authorize');
      for(const [name,value] of Object.entries({client_id:env.GITHUB_CLIENT_ID,redirect_uri:settings.auth+'/callback',scope:settings.scope,state:session.state,code_challenge:challenge,code_challenge_method:'S256',allow_signup:'false'}))target.searchParams.set(name,value);
      return new Response(null,{status:302,headers:{...baseHeaders,Location:target.href,'Set-Cookie':cookie(await signSession(session,env.SESSION_SECRET))}});
    }
    if(url.pathname==='/callback') {
      const raw=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      const session=await readSession(raw,env.SESSION_SECRET);
      if(!session||url.searchParams.get('state')!==session.state)return error('Sign-in verification failed. Return to the editor and try again.',403);
      if(url.searchParams.get('error')||!url.searchParams.get('code'))return error('GitHub sign-in was cancelled. Return to the editor to try again.');
      try{
        const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:settings.auth+'/callback',code_verifier:session.verifier})});
        if(!tokenResponse.ok)return error('GitHub authentication is temporarily unavailable.',502);
        const credentials=await tokenResponse.json();
        if(!credentials.access_token||credentials.token_type!=='bearer')return error('GitHub could not complete sign-in. Please try again.',403);
        const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+credentials.access_token,'User-Agent':'Thrive-PTO-CMS','X-GitHub-Api-Version':'2022-11-28'};
        const userResponse=await fetch('https://api.github.com/user',{headers});
        if(!userResponse.ok)return error('Your GitHub account could not be checked.',403);
        const user=await userResponse.json();
        const approvedUsername=settings.users.includes(String(user.login||'').toLowerCase());
        let approvedAdminEmail=false;
        if(settings.adminEmails.length){
          const emailResponse=await fetch('https://api.github.com/user/emails?per_page=100',{headers});
          if(!emailResponse.ok)return error('Your verified GitHub email addresses could not be checked. Return to the editor and authorize email access.',403);
          const addresses=await emailResponse.json();
          if(!Array.isArray(addresses))return error('Your verified GitHub email addresses could not be checked.',403);
          approvedAdminEmail=addresses.some(address=>address.verified===true&&settings.adminEmails.includes(String(address.email||'').trim().toLowerCase()));
        }
        if(!approvedUsername&&!approvedAdminEmail)return error('This account has not been approved as a PTO editor. Check that your approved email is verified in GitHub.',403);
        const repositoryResponse=await fetch('https://api.github.com/repos/'+env.REPOSITORY,{headers});
        if(!repositoryResponse.ok)return error('Your account does not have access to the PTO repository.',403);
        const repository=await repositoryResponse.json();
        if(!repository.permissions?.push)return error('Your account does not have PTO editing permission.',403);
        const role=approvedAdminEmail||repository.permissions.admin?'admin':'editor';
        return authorizedPopup(credentials.access_token,settings.cms,role);
      }catch{return error('Sign-in could not be completed. Please try again.',502);}
    }
    return error('Not found.',404,false);
  }
};

