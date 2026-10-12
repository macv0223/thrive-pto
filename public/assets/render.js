export const pageKeys = ['home', 'about', 'events', 'volunteer', 'membership', 'support', 'updates'];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function asset(value, base = './', preview = false) {
  const raw = String(value ?? '');
  if (preview && raw.startsWith('blob:')) return raw;
  if (safeUrl(raw)) return safeUrl(raw);
  try {
    const clean = decodeURIComponent(raw.replace(/^\/+/, ''));
    if(clean.startsWith('assets/') && !/[\\?#\u0000-\u001f]/.test(clean) && !clean.split('/').includes('..'))return base + clean.split('/').map(encodeURIComponent).join('/');
  } catch {}
  return base + 'assets/community-placeholder.svg';
}

export function icon(name, className = '') {
  const drawings = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M14 5h5v5m0-5-9 9M10 5H5v14h14v-5"/>',
    leaf: '<path d="M19 4C9 3 3 9 6 15c3 6 13 3 13-11ZM5 20l9-10"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2"/>',
    heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-3 3-1 7 8 14C21 12 23 8 20 5Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    shop: '<path d="M5 8h14l2 13H3L5 8Zm3 0V6a4 4 0 0 1 8 0v2"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
  };
  return `<svg class="icon ${esc(className)}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.leaf}</svg>`;
}

const paras = value => String(value ?? '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const link = (text, href, kind = 'button', external = false) => `<a class="${esc(kind)}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(text)}${icon(external ? 'external' : 'arrow')}${external ? '<span class="sr-only"> (opens in a new tab)</span>' : ''}</a>`;
const mailLink = (email, subject = '') => `mailto:${encodeURIComponent(email)}${subject ? '?subject='+encodeURIComponent(subject) : ''}`;

export function upcomingEvents(events = [], now = new Date()) {
  return events.filter(e => {
    if (e.published === false) return false;
    const t = Date.parse(e.end || e.start);
    if (!Number.isFinite(t)) return false;
    // Keep today's events visible through the end of the school-local calendar day.
    const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
    const eventDay = e.allDay ? String(e.end || e.start).slice(0,10) : new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
    return eventDay >= today;
  }).sort((a,b) => Date.parse(a.start)-Date.parse(b.start));
}

export function eventDate(e) {
  const date = new Date(e.start);
  if (!Number.isFinite(date.getTime())) return {day:'',month:'',full:'',time:''};
  const timeZone = e.allDay ? 'UTC' : 'America/Chicago';
  const fmt = options => new Intl.DateTimeFormat('en-US', {timeZone,...options}).format(date);
  return {
    day: fmt({day:'2-digit'}), month: fmt({month:'short'}),
    full: fmt({weekday:'long',month:'long',day:'numeric',year:'numeric'}),
    time: e.allDay ? 'All day' : fmt({hour:'numeric',minute:'2-digit',timeZoneName:'short'})
  };
}

function eventCard(e, base) {
  const d = eventDate(e);
  return `<article class="event-card" data-event data-category="${esc(e.category || 'PTO event')}" data-search="${esc([e.title,e.description,e.location].join(' ').toLowerCase())}">
    <div class="date-tile" aria-hidden="true"><span>${esc(d.month)}</span><strong>${esc(d.day)}</strong></div>
    <div class="event-details"><span class="eyebrow">${esc(e.category || 'PTO event')}</span><h3>${esc(e.title)}</h3>
      <p class="event-meta">${icon('calendar')}<time datetime="${esc(e.start)}">${esc(d.full)} · ${esc(d.time)}</time></p>
      ${e.location ? `<p class="event-meta">${icon('pin')}${esc(e.location)}</p>` : ''}
      ${paras(e.description)}
      <div class="event-actions">${safeUrl(e.link) ? link(e.linkLabel || 'Event details',safeUrl(e.link),'text-link',true) : ''}<button class="text-link calendar-download" data-event-id="${esc(e.id)}">Add to calendar ${icon('download')}</button></div>
    </div></article>`;
}

function emptyEvents(data, base) {
  const e = data['events-page'];
  return `<div class="empty-state"><div class="empty-symbol">${icon('calendar')}</div><div><h3>${esc(e.emptyTitle)}</h3>${paras(e.emptyBody)}${link(e.contactLabel,mailLink(data.settings.email,'PTO events'),'text-link')}</div><span class="empty-leaf" aria-hidden="true">${icon('leaf')}</span></div>`;
}

function newsCards(data, limit = Infinity, base = './', preview = false) {
  return (data.news || []).filter(n => n.published !== false).sort((a,b) => Date.parse(b.date)-Date.parse(a.date)).slice(0,limit).map(n => `<article class="news-card">
    ${n.image ? `<img src="${esc(asset(n.image,base,preview))}" alt="${esc(n.imageAlt || '')}" loading="lazy" width="640" height="400">` : ''}
    <time datetime="${esc(n.date)}">${esc(new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(n.date)))}</time><h3>${esc(n.title)}</h3>${paras(n.body)}${safeUrl(n.link) ? link(n.linkLabel || 'Learn more',safeUrl(n.link),'text-link',true):''}</article>`).join('');
}

function heading(page) {
  return `<section class="page-intro"><div class="container"><p class="eyebrow">${esc(page.eyebrow)}</p><h1>${esc(page.title)}</h1><div class="page-lead">${paras(page.intro)}</div></div></section>`;
}

function membershipCards(data, base, compact = false) {
  const m = data.membership;
  return `<div class="membership-grid ${compact ? 'compact' : ''}">
    <article class="membership-card family"><div class="membership-top">${icon('people')}<span>For your household</span></div><h3>${esc(m.familyTitle)}</h3><div class="vote-count"><strong>2</strong><span>voting members</span></div>${paras(m.familyBody)}<div class="card-bottom">${link('Choose family membership',safeUrl(data.settings.membershipUrl),'text-link',true)}</div></article>
    <article class="membership-card"><div class="membership-top">${icon('leaf')}<span>For one member</span></div><h3>${esc(m.individualTitle)}</h3><div class="vote-count"><strong>1</strong><span>voting member</span></div>${paras(m.individualBody)}<div class="card-bottom">${link('Choose individual membership',safeUrl(data.settings.membershipUrl),'text-link',true)}</div></article>
  </div>`;
}

function home(data, base, preview) {
  const h=data.home, s=data.settings;
  const events=upcomingEvents(data.events).slice(0,3);
  return `<section class="hero"><div class="container hero-grid">
    <div class="hero-copy"><p class="eyebrow"><span class="small-leaf">${icon('leaf')}</span>${esc(h.eyebrow)}</p><h1>${esc(h.title)}</h1><div class="hero-lead">${paras(h.intro)}</div>
    <div class="button-row">${link(h.primaryLabel,base+'membership.html')}${link(h.secondaryLabel,base+'volunteer.html','button button-outline')}</div>
    <div class="hero-footnote"><span class="tiny-mark" aria-hidden="true">${icon('people')}</span><span>Thrive Center for Success<br><strong>Parent–Teacher Organization</strong></span></div></div>
    <figure class="hero-art"><img src="${esc(asset(h.image,base,preview))}" alt="${esc(h.imageAlt)}" width="1000" height="1020" fetchpriority="high"><figcaption>${esc(h.imageCaption)}</figcaption><div class="art-sticker" aria-hidden="true">Every little<br><em>helps.</em>${icon('heart')}</div></figure>
    </div></section>
    <section class="path-section"><div class="container"><div class="section-heading"><div><p class="eyebrow">Start here</p><h2>${esc(h.pathsTitle)}</h2></div><p>${esc(h.pathsIntro)}</p></div>
    <div class="path-grid">${[
      ['people',s.navMembership,'Have a voice in important PTO decisions.','membership'],
      ['heart',s.navVolunteer,'An hour or a larger role—every contribution is appreciated.','volunteer'],
      ['calendar',s.navEvents,'Find upcoming PTO events and ways to connect.','events']
    ].map(([i,t,p,key],index)=>`<a class="path-card" href="${base+key}.html"><span class="path-icon">${icon(i)}</span><span class="path-number">0${index+1}</span><h3>${esc(t)}</h3><p>${esc(p)}</p><span class="path-arrow">${icon('arrow')}</span></a>`).join('')}</div></div></section>
    <section class="events-section"><div class="container"><div class="section-heading"><div><p class="eyebrow">On the calendar</p><h2>${esc(h.eventsTitle)}</h2><p>${esc(h.eventsIntro)}</p></div>${link('All events',base+'events.html','text-link')}</div><div class="event-list">${events.length ? events.map(e=>eventCard(e,base)).join('') : emptyEvents(data,base)}</div></div></section>
    <section class="volunteer-feature"><div class="container volunteer-feature-grid"><div class="feature-art" aria-hidden="true"><div class="big-heart">${icon('heart')}</div><span class="mini-label">A little time.<br>A lot of heart.</span><span class="feature-spark">${icon('star')}</span></div><div><p class="eyebrow">Many hands. One community.</p><h2>${esc(h.volunteerTitle)}</h2>${paras(h.volunteerIntro)}<div class="chips">${data.volunteer.areas.slice(0,4).map(a=>`<span>${esc(a)}</span>`).join('')}</div>${link('Explore volunteering',base+'volunteer.html')}</div></div></section>
    <section class="membership-section"><div class="container"><div class="section-heading"><div><p class="eyebrow">PTO membership · ${esc(s.schoolYear)}</p><h2>${esc(h.membershipTitle)}</h2><p>${esc(h.membershipIntro)}</p></div>${link('Membership details',base+'membership.html','text-link')}</div>${membershipCards(data,base,true)}</div></section>
    ${(data.news || []).some(n=>n.published!==false) ? `<section class="news-section"><div class="container"><div class="section-heading"><h2>PTO updates</h2>${link('All updates',base+'updates.html','text-link')}</div><div class="news-grid">${newsCards(data,3,base,preview)}</div></div></section>` : ''}
    <section class="contact-band"><div class="container contact-band-inner"><div><p class="eyebrow">Questions? We're here to help.</p><h2>${esc(h.contactTitle)}</h2><p>${esc(h.contactIntro)}</p></div>${link('Email the PTO',mailLink(s.email),'button button-light')}</div></section>`;
}

function about(data, base) {
  const a=data.about;
  return `${heading(a)}<section class="section"><div class="container about-layout"><div class="about-copy"><p class="eyebrow">Thrive Center for Success PTO</p><h2>${esc(a.boardTitle)}</h2>${paras(a.boardBody)}${link('Explore membership',base+'membership.html')}<hr><h2>${esc(a.volunteerTitle)}</h2>${paras(a.volunteerBody)}${link('Find a volunteer opportunity',base+'volunteer.html','text-link')}</div><aside class="contact-card">${icon('mail')}<h2>${esc(a.contactTitle)}</h2>${paras(a.contactBody)}<a class="email-address" href="${mailLink(data.settings.email)}">${esc(data.settings.email)}</a><hr><p>Looking for information about the school?</p>${link('Visit the school website',safeUrl(data.settings.schoolUrl),'text-link',true)}</aside></div></section>`;
}

function membership(data,base) {
  const m=data.membership;
  return `${heading(m)}<section class="section membership-page"><div class="container"><div class="membership-explainer"><span class="round-icon">${icon('people')}</span><div><h2>${esc(m.voiceTitle)}</h2>${paras(m.voiceBody)}</div><span class="year-tag">${esc(data.settings.schoolYear)}</span></div>${membershipCards(data,base)}<div class="membership-note">${icon('external')}<p>${esc(m.paymentNote)}</p></div><div class="simple-callout"><div><h2>${esc(m.contactTitle)}</h2>${paras(m.contactBody)}</div>${link('Ask about membership',mailLink(data.settings.email,'PTO membership'),'button button-outline')}</div></div></section>`;
}

function volunteer(data,base) {
  const v=data.volunteer;
  const icons=['heart','leaf','shop','star','people','leaf','calendar'];
  return `${heading(v)}<section class="section"><div class="container"><div class="section-heading"><h2>${esc(v.areasTitle)}</h2><span class="quiet-note">Every contribution is appreciated.</span></div><div class="volunteer-grid">${v.areas.map((a,i)=>`<a href="#volunteer-signup" class="volunteer-area" data-interest="${esc(a)}"><span>${icon(icons[i%icons.length])}</span><h3>${esc(a)}</h3>${icon('arrow')}</a>`).join('')}</div>
    <div id="volunteer-signup" class="volunteer-form-layout"><div class="signup-copy"><p class="eyebrow">Let's get you connected</p><h2>${esc(v.formTitle)}</h2>${paras(v.formIntro)}<p class="signup-email">You can also write directly to<br><a href="${mailLink(data.settings.email)}">${esc(data.settings.email)}</a>.</p></div>
    <form id="volunteer-form" class="volunteer-form" data-email="${esc(data.settings.email)}"><div class="form-row"><div><label for="volunteer-name">Your name <span>(required)</span></label><input id="volunteer-name" name="name" autocomplete="name" required maxlength="120"></div><div><label for="volunteer-email">Your email <span>(required)</span></label><input id="volunteer-email" name="email" type="email" autocomplete="email" required maxlength="254"></div></div>
    <fieldset><legend>I'm interested in <span>(choose any)</span></legend><div class="interest-options">${v.areas.map((a,i)=>`<label class="checkbox-option"><input type="checkbox" name="interests" value="${esc(a)}" id="interest-${i}"><span>${esc(a)}</span></label>`).join('')}</div></fieldset>
    <label for="volunteer-message">Anything you'd like us to know? <span>(optional)</span></label><textarea id="volunteer-message" name="message" rows="4" maxlength="2000" placeholder="Your availability, questions, or how you'd like to help..."></textarea><p class="form-note">${esc(v.formNote)}</p><div class="form-buttons"><button class="button" type="submit">${esc(v.formButton)}${icon('mail')}</button><button class="text-link" id="copy-volunteer" type="button">Copy message</button></div><p id="form-status" class="form-status" aria-live="polite"></p><div id="message-fallback" hidden><label for="message-copy">Your prepared message</label><textarea id="message-copy" rows="8" readonly></textarea></div></form></div></div></section>`;
}

function events(data,base) {
  const items=upcomingEvents(data.events);
  const cats=[...new Set(items.map(e=>e.category||'PTO event'))];
  return `${heading(data['events-page'])}<section class="section"><div class="container">${items.length ? `<div class="event-tools"><label class="search-field">Find an event<input type="search" id="event-search" placeholder="Search events" aria-controls="events-list"></label><label class="category-field">Event type<select id="event-category" aria-controls="events-list"><option value="">All events</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label></div><p id="event-status" class="quiet-note" aria-live="polite">${items.length} upcoming ${items.length===1?'event':'events'}</p>`:''}<div class="event-list" id="events-list">${items.length ? items.map(e=>eventCard(e,base)).join(''):emptyEvents(data,base)}</div><p id="event-no-results" class="no-results" hidden>No events match your search. Try a different word or event type.</p></div></section>`;
}

function support(data,base) {
  const s=data.support;
  return `${heading(s)}<section class="section"><div class="container support-grid"><article class="support-card store-card"><span class="round-icon">${icon('shop')}</span><p class="eyebrow">Shop on FutureFund</p><h2>${esc(s.storeTitle)}</h2>${paras(s.storeBody)}${link(s.storeLabel,safeUrl(data.settings.storeUrl))}<p class="external-note">Opens the Thrive store on FutureFund.</p></article><article class="support-card"><span class="round-icon">${icon('people')}</span><p class="eyebrow">Have a voice</p><h2>${esc(s.membershipTitle)}</h2>${paras(s.membershipBody)}${link(s.membershipLabel,base+'membership.html','button button-outline')}</article></div></section>`;
}

function updates(data,base,preview) {
  const n=data['news-page'];
  return `${heading(n)}<section class="section"><div class="container"><div class="news-grid">${newsCards(data,Infinity,base,preview)||`<div class="empty-state"><div class="empty-symbol">${icon('mail')}</div><div><h3>${esc(n.emptyTitle)}</h3>${paras(n.emptyBody)}${link('Email the PTO',mailLink(data.settings.email),'text-link')}</div></div>`}</div></div></section>`;
}

export function renderBody(page,data,{base='./',preview=false}={}) {
  const s=data.settings;
  const nav=[['about',s.navAbout],['events',s.navEvents],['volunteer',s.navVolunteer],['membership',s.navMembership],['support',s.navSupport]];
  const navHTML=nav.map(([key,label])=>`<a href="${esc(base+key+'.html')}"${page===key?' aria-current="page"':''}>${esc(label)}</a>`).join('');
  const renderers={home,about,events,volunteer,membership,support,updates};
  return `<a class="skip-link" href="#main">Skip to content</a><div class="announcement-bar"><div class="container"><span>PTO membership · ${esc(s.schoolYear)}</span><a href="${esc(base+'membership.html')}">Find the right membership for your family ${icon('arrow')}</a></div></div>
    <header class="site-header"><div class="container header-inner"><a class="brand" href="${esc(base+'index.html')}" aria-label="${esc(s.name)} home"><img src="${esc(asset(s.logo,base,preview))}" alt="Thrive Center for Success PTO" width="260" height="100"><span class="brand-name">Thrive Center<br>for Success <strong>PTO</strong></span></a><nav class="desktop-nav" aria-label="Main navigation">${navHTML}</nav><button id="menu-toggle" class="menu-toggle" aria-expanded="false" aria-controls="mobile-nav">${icon('menu')}<span>Menu</span></button></div><nav id="mobile-nav" class="mobile-nav" aria-label="Mobile navigation" hidden>${navHTML}<a href="${esc(base+'updates.html')}">PTO updates</a></nav></header>
    <main id="main" tabindex="-1">${(renderers[page]||home)(data,base,preview)}</main>
    <footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><a href="${esc(base+'index.html')}" aria-label="Thrive PTO home"><img src="${esc(asset(s.logo,base,preview))}" alt="Thrive Center for Success PTO" loading="lazy" width="260" height="100"></a><p>${esc(s.footerText)}</p></div><div><h2>Get involved</h2><nav aria-label="Footer involvement links"><a href="${esc(base+'membership.html')}">Membership</a><a href="${esc(base+'volunteer.html')}">Volunteer opportunities</a><a href="${esc(base+'events.html')}">Upcoming events</a><a href="${esc(base+'support.html')}">Store & support</a></nav></div><div><h2>Stay connected</h2><nav aria-label="Footer contact links"><a href="${mailLink(s.email)}">${esc(s.email)}</a><a href="${esc(base+'about.html')}">About the PTO</a><a href="${esc(base+'updates.html')}">PTO updates</a><a href="${esc(safeUrl(s.schoolUrl))}" target="_blank" rel="noopener noreferrer">School website ${icon('external')}<span class="sr-only"> (opens in a new tab)</span></a></nav></div></div><div class="container footer-bottom"><p>© ${new Date().getFullYear()} ${esc(s.name)}</p><a href="${esc(base+'admin/')}">PTO editor login ${icon('arrow')}</a></div></footer>`;
}
