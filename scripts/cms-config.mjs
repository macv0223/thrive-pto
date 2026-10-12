import {readFileSync} from 'node:fs';
import path from 'node:path';
import {root,contentNames} from './model.mjs';
import {safeUrl} from '../public/assets/render.js';

const label=s=>s.replace(/([A-Z])/g,' $1').replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());
function field(name,value) {
  const item={name,label:label(name),widget:'string'};
  if(Array.isArray(value))return {...item,widget:'list',min:1,field:{name:'area',label:'Volunteer area',widget:'string'}};
  if(name==='image'||name==='logo')return {...item,widget:'image',hint:'Upload an approved image. Use the image description field to describe meaningful content.'};
  if(name==='imageAlt')return {...item,label:'Image description (accessibility)',widget:'text'};
  if(/Body$|Intro$|intro|description|footerText|formNote|paymentNote/i.test(name))item.widget='text';
  if(name==='email')item.pattern=['^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$','Enter a valid email address.'];
  if(/Url$/.test(name))item.pattern=['^https://[^\\s]+$','Use a complete https:// link.'];
  if(name==='imageCaption')item.hint='Keep the illustration/placeholder description until you replace the image with an approved photograph.';
  return item;
}
export function cmsConfig(setup) {
  const pageFiles=contentNames.filter(n=>n!=='settings').map(name=>({name,label:({home:'Home',about:'About the PTO',membership:'Membership',volunteer:'Volunteering','events-page':'Events page','news-page':'Updates page',support:'Store & support'})[name],file:'content/'+name+'.json',fields:Object.entries(JSON.parse(readFileSync(path.join(root,'content',name+'.json'),'utf8'))).map(([k,v])=>field(k,v))}));
  const optionalLink=[{name:'link',label:'Optional link',widget:'string',required:false,pattern:['^https://[^\\s]+$','Use a complete https:// link.']},{name:'linkLabel',label:'Link button text',widget:'string',required:false}];
  return {
    backend:{name:'github',repo:setup.repository||'SETUP_REQUIRED/SETUP_REQUIRED',branch:setup.branch||'main',base_url:safeUrl(setup.oauthOrigin)?new URL(setup.oauthOrigin).origin:'https://setup-required.invalid',auth_endpoint:'auth',squash_merges:true},
    publish_mode:'editorial_workflow',media_folder:'public/assets/uploads',public_folder:'assets/uploads',slug:{encoding:'ascii',clean_accents:true,sanitize_replacement:'-'},
    site_url:safeUrl(setup.siteUrl)||undefined,display_url:safeUrl(setup.siteUrl)||undefined,
    logo_url:'../assets/pto-logo.webp',show_preview_links:false,
    collections:[
      {name:'pages',label:'Website pages',files:pageFiles},
      {name:'settings',label:'Site settings & links',files:[{name:'settings',label:'Branding, contact & links',file:'content/settings.json',fields:Object.entries(JSON.parse(readFileSync(path.join(root,'content/settings.json'),'utf8'))).map(([k,v])=>field(k,v))}]},
      {name:'events',label:'PTO events',label_singular:'PTO event',folder:'content/events',create:true,extension:'json',format:'json',slug:'{{year}}-{{month}}-{{day}}-{{slug}}',summary:'{{title}} · {{start}}',identifier_field:'title',sortable_fields:['start','title'],fields:[
        {name:'title',label:'Event title',widget:'string'},
        {name:'start',label:'Start date & time',widget:'datetime',date_format:'MM/DD/YYYY',time_format:'h:mm A',format:'YYYY-MM-DDTHH:mm:ssZ',picker_utc:false,hint:'Enter Magnolia, Texas time. For an all-day event, the calendar date you enter is used.'},
        {name:'end',label:'End date & time (optional)',widget:'datetime',required:false,format:'YYYY-MM-DDTHH:mm:ssZ',picker_utc:false,hint:'For an all-day event, the end date is the last included day.'},
        {name:'allDay',label:'All-day event',widget:'boolean',default:false},
        {name:'category',label:'Event type',widget:'select',options:['PTO event','Fundraising','Spirit Night','Staff Appreciation','Meeting'],default:'PTO event'},
        {name:'location',label:'Location (optional)',widget:'string',required:false},
        {name:'description',label:'Event details',widget:'text'},...optionalLink,
        {name:'published',label:'Show on the website after publishing',widget:'boolean',default:true}
      ]},
      {name:'news',label:'News & announcements',label_singular:'Announcement',folder:'content/news',create:true,extension:'json',format:'json',slug:'{{year}}-{{month}}-{{day}}-{{slug}}',summary:'{{title}}',fields:[
        {name:'title',label:'Announcement title',widget:'string'},
        {name:'date',label:'Announcement date',widget:'datetime',date_format:'MM/DD/YYYY',time_format:false,format:'YYYY-MM-DD'},
        {name:'body',label:'Announcement text',widget:'text'},
        {name:'image',label:'Approved image (optional)',widget:'image',required:false},
        {name:'imageAlt',label:'Image description (accessibility)',widget:'text',required:false},...optionalLink,
        {name:'published',label:'Show on the website after publishing',widget:'boolean',default:true}
      ]}
    ]
  };
}
