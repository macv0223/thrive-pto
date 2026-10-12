import {renderBody} from '../assets/render.js';
const status=document.querySelector('#admin-status'),button=document.querySelector('#open-cms');
try {
  const state=await fetch('setup-status.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Connection unavailable');return r.json();});
  if(!state.configured) {
    status.textContent='Editor sign-in is awaiting account setup. The website is available to browse; your website administrator needs to finish connecting editing access.';
  } else {
    status.textContent='Use your individually approved GitHub account to sign in. Changes can be saved as drafts before publication.';
    button.hidden=false;
    button.addEventListener('click',async()=>{
      button.disabled=true;status.textContent='Opening the content manager…';
      try {
        const [config,data]=await Promise.all([fetch('config.json',{cache:'no-store'}).then(r=>r.json()),fetch('../data/site.json',{cache:'no-store'}).then(r=>r.json())]);
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='decap-cms.js';script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the content manager. Please check your connection and try again.'));document.body.append(script);});
        const base=new URL('../',location.href).href;
        const WebsitePreview=window.createClass({
          render(){
            const props=this.props,entry=props.entry.toJS(),values=entry.data,collection=props.collection.get('name');
            const snapshot=structuredClone(data);let page='home';
            if(collection==='events'){snapshot.events=[{...values,id:'draft'}];page='events';}
            else if(collection==='news'){snapshot.news=[{...values,id:'draft'}];page='updates';}
            else{const slug=entry.slug;snapshot[slug]=values;page=slug==='settings'?'home':slug==='events-page'?'events':slug==='news-page'?'updates':slug;}
            // Decap getAsset resolves new uploads into temporary blob URLs for preview.
            for(const record of [snapshot.settings,snapshot.home,...snapshot.news])for(const key of ['logo','image'])if(record?.[key]){const found=props.getAsset(record[key]);if(found)record[key]=String(found);}
            const source=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}assets/site.css"><body>${renderBody(page,snapshot,{base,preview:true})}</body></html>`;
            return window.h('iframe',{srcDoc:source,title:'Website draft preview',style:{width:'100%',height:'900px',border:'none'},sandbox:'allow-same-origin'});
          }
        });
        for(const name of ['pages','settings','events','news'])window.CMS.registerPreviewTemplate(name,WebsitePreview);
        for(const name of config.collections[0].files.map(f=>f.name))window.CMS.registerPreviewTemplate(name,WebsitePreview);
        config.load_config_file=false;
        window.CMS.init({config});
        document.querySelector('#admin-welcome').hidden=true;
      } catch(error){status.textContent=error.message;button.disabled=false;}
    });
  }
} catch(error){status.textContent='The editor connection could not be checked. Please reload the page or contact your website administrator.';}
