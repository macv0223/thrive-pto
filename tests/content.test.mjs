import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContent,validateContent} from '../scripts/model.mjs';
import {renderBody,upcomingEvents,safeUrl,asset,eventDate} from '../public/assets/render.js';
import {volunteerMessage,calendarFile} from '../public/assets/actions.js';

test('supplied membership options and exact contact/link details remain authoritative',async()=>{
  const data=validateContent(await loadContent());
  assert.equal(data.settings.email,'pto.thrive@gmail.com');
  assert.equal(data.settings.membershipUrl,'https://tcfs.futurefund.com/store/campaigns/74548-pto-membership-2026-2027');
  assert.equal(data.settings.storeUrl,'https://tcfs.futurefund.com/store');
  assert.match(data.membership.familyBody,/two voting members/);assert.match(data.membership.individualBody,/one voting member/);
  assert.equal(data.events.length,0);assert.equal(data.news.length,0);
});
test('CMS edits update actual rendered pages and escape untrusted text',async()=>{
  const data=await loadContent();data.home.title='<script>alert("x")</script>';data.settings.email='new@example.org';
  const html=renderBody('home',data);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('mailto:new%40example.org'));
  assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('https://user:pass@example.com'),'');
  assert.equal(asset('assets/../secret'),'./assets/community-placeholder.svg');
});
test('events sort correctly, omit hidden/past entries, and keep the current Central day visible',()=>{
  const events=[{id:'late',start:'2026-10-15T20:00:00-05:00'},{id:'today',start:'2026-10-12T08:00:00-05:00'},{id:'past',start:'2026-10-11T19:00:00-05:00'},{id:'hidden',start:'2026-10-14T12:00:00-05:00',published:false},{id:'invalid',start:'not a date'}];
  assert.deepEqual(upcomingEvents(events,new Date('2026-10-12T23:00:00Z')).map(e=>e.id),['today','late']);
  assert.match(eventDate(events[0]).time,/8:00 PM/);
});
test('volunteer form prepares an email draft with the supplied interests',()=>{
  const message=volunteerMessage({name:'Pat\r\nSmith',email:'pat@example.org',interests:['Hospitality','Events'],message:'I can help on Fridays.'});
  assert.match(message,/Name: Pat Smith/);assert.match(message,/Hospitality, Events/);assert.match(message,/Fridays/);
});
test('calendar export respects time offsets, all-day end dates, Unicode folding, and newline escaping',()=>{
  const calendar=calendarFile({id:'event',title:'Gathering, together; café',start:'2026-11-03T18:00:00-06:00',description:'Line one\nLine two',location:'School'},new Date('2026-10-12T12:00:00Z'));
  assert.match(calendar,/DTSTART:20261104T000000Z/);assert.match(calendar,/SUMMARY:Gathering\\, together\\; café/);assert.match(calendar,/Line one\\nLine two/);
  const day=calendarFile({id:'day',title:'All day',allDay:true,start:'2026-11-03',end:'2026-11-04'});
  assert.match(day,/DTEND;VALUE=DATE:20261105/);
});
test('invalid content blocks publication',async()=>{
  const data=await loadContent();data.events=[{id:'invalid',title:'Bad end',start:'2026-12-02',end:'2026-12-01'}];
  assert.throws(()=>validateContent(data),/end must not be before start/);
});
