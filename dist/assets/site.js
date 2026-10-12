import {volunteerMessage,calendarFile} from './actions.js';

const menuToggle=document.querySelector('#menu-toggle');
const mobileNav=document.querySelector('#mobile-nav');
function closeMenu(){if(!mobileNav)return;mobileNav.hidden=true;menuToggle.setAttribute('aria-expanded','false');}
menuToggle?.addEventListener('click',()=>{const open=menuToggle.getAttribute('aria-expanded')!=='true';menuToggle.setAttribute('aria-expanded',String(open));mobileNav.hidden=!open;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileNav&&!mobileNav.hidden){closeMenu();menuToggle.focus();}});
window.matchMedia('(min-width: 761px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
mobileNav?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});

const form=document.querySelector('#volunteer-form');
function prepareMessage(){
  if(!form.reportValidity())return null;
  const values=new FormData(form);
  const message=volunteerMessage({name:values.get('name'),email:values.get('email'),interests:values.getAll('interests'),message:values.get('message')});
  document.querySelector('#message-copy').value=message;
  return message;
}
form?.addEventListener('submit',event=>{
  event.preventDefault();
  const message=prepareMessage();if(!message)return;
  const draft=document.createElement('a');
  draft.href=`mailto:${encodeURIComponent(form.dataset.email)}?subject=${encodeURIComponent('Thrive PTO volunteer interests')}&body=${encodeURIComponent(message)}`;
  draft.click();
  document.querySelector('#form-status').textContent="Email draft requested. Review and send it in your email app. If no app opens, use Copy message and email the PTO directly.";
});
document.querySelector('#copy-volunteer')?.addEventListener('click',async()=>{
  const message=prepareMessage();if(!message)return;
  try{await navigator.clipboard.writeText(message);document.querySelector('#form-status').textContent='Message copied. Paste it into an email to '+form.dataset.email+'.';}
  catch{document.querySelector('#message-fallback').hidden=false;document.querySelector('#message-copy').select();document.querySelector('#form-status').textContent='Copy your prepared message from the box below, then email it to the PTO.';}
});
document.querySelectorAll('[data-interest]').forEach(link=>link.addEventListener('click',()=>{
  const box=Array.from(form?.querySelectorAll('[name="interests"]')||[]).find(input=>input.value===link.dataset.interest);
  if(box)box.checked=true;
  document.querySelector('#volunteer-name')?.focus({preventScroll:true});
}));

const search=document.querySelector('#event-search'), category=document.querySelector('#event-category');
function filterEvents(){
  const term=search.value.trim().toLowerCase();let count=0;
  document.querySelectorAll('[data-event]').forEach(card=>{const visible=(!term||card.dataset.search.includes(term))&&(!category.value||category.value===card.dataset.category);card.hidden=!visible;if(visible)count++;});
  document.querySelector('#event-status').textContent=`${count} ${count===1?'event':'events'} shown`;
  document.querySelector('#event-no-results').hidden=count>0;
}
search?.addEventListener('input',filterEvents);category?.addEventListener('change',filterEvents);
const eventData=JSON.parse(document.querySelector('#event-data')?.textContent||'[]');
document.querySelectorAll('.calendar-download').forEach(button=>button.addEventListener('click',()=>{
  const entry=eventData.find(event=>event.id===button.dataset.eventId);if(!entry)return;
  const url=URL.createObjectURL(new Blob([calendarFile(entry)],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='thrive-pto-'+entry.id+'.ics';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}));
