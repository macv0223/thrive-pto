export function contentPath(path){return /^content\/(?:[a-z0-9-]+\.json|(?:events|news)\/[a-z0-9._-]+\.json)$/.test(path)||/^public\/assets\/uploads\/[^\\\u0000-\u001f]+$/.test(path)&&!path.split('/').includes('..');}

export function githubClient(repo,token,fetcher=fetch){
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo))throw new Error('Invalid repository');
  return async(endpoint,{method='GET',body}={})=>{
    const response=await fetcher('https://api.github.com/repos/'+repo+endpoint,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){const problem=await response.json().catch(()=>({}));throw new Error(problem.message||'GitHub could not complete the request.');}
    return response.json();
  };
}

export async function prepareRestoration(api,revision,branch='main') {
  if(!/^[a-f0-9]{40}$/i.test(revision))throw new Error('Invalid revision');
  const [reference,oldCommit]=await Promise.all([api('/git/ref/heads/'+encodeURIComponent(branch)),api('/git/commits/'+revision)]);
  const currentCommit=await api('/git/commits/'+reference.object.sha);
  const [current,old]=await Promise.all([api('/git/trees/'+currentCommit.tree.sha+'?recursive=1'),api('/git/trees/'+oldCommit.tree.sha+'?recursive=1')]);
  if(current.truncated||old.truncated)throw new Error('Repository is too large for a safe automatic restoration. Ask your administrator for help.');
  const previous=new Map(old.tree.filter(t=>t.type==='blob'&&contentPath(t.path)).map(t=>[t.path,t]));
  const live=new Map(current.tree.filter(t=>t.type==='blob'&&contentPath(t.path)).map(t=>[t.path,t]));
  const changes=[];
  for(const name of [...new Set([...previous.keys(),...live.keys()])].sort())if(previous.get(name)?.sha!==live.get(name)?.sha)changes.push({path:name,mode:'100644',type:'blob',sha:previous.get(name)?.sha||null});
  return{revision,base:reference.object.sha,baseTree:currentCommit.tree.sha,branch,changes,files:[...previous.values()]};
}

export async function createRestorationDraft(api,plan) {
  if(!plan.changes.length)throw new Error('This revision already matches the current content.');
  if(plan.changes.some(t=>!contentPath(t.path)))throw new Error('Restoration may only change content and uploaded images.');
  const ref=await api('/git/ref/heads/'+encodeURIComponent(plan.branch));
  if(ref.object.sha!==plan.base)throw new Error('New changes were published while you reviewed this restoration. Reload and review again.');
  const tree=await api('/git/trees',{method:'POST',body:{base_tree:plan.baseTree,tree:plan.changes}});
  const commit=await api('/git/commits',{method:'POST',body:{message:'Restore PTO content from '+plan.revision.slice(0,7),tree:tree.sha,parents:[plan.base]}});
  const branch='restore/content-'+Date.now();
  await api('/git/refs',{method:'POST',body:{ref:'refs/heads/'+branch,sha:commit.sha}});
  return api('/pulls',{method:'POST',body:{title:'Restore PTO content from '+plan.revision.slice(0,7),head:branch,base:plan.branch,body:'Restores website copy, events, announcements, and uploaded images to revision '+plan.revision+'. Application code and authentication settings are not restored. Review all newer content that will be replaced before merging. Merge this draft to publish through the normal Pages deployment workflow.',draft:true}});
}
