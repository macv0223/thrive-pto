const line = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

export function volunteerMessage({name,email,interests=[],message=''}) {
  return `Hello Thrive PTO,\n\nI'd like to get connected about volunteering.\n\nName: ${line(name)}\nEmail: ${line(email)}\nInterests: ${interests.length ? interests.map(line).join(', ') : 'Please help me find a suitable opportunity'}\n\n${String(message).trim()}\n\nThank you!`;
}

const icalEscape = value => String(value ?? '').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const isoDate = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid event date');
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
};
function fold(value) {
  let current='', result='';
  for(const character of value) {
    if(new TextEncoder().encode(current+character).length>73){result+=current+'\r\n ';current=character;}else current+=character;
  }
  return result+current;
}
export function calendarFile(event, now = new Date()) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Thrive Center for Success PTO//PTO Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${icalEscape(event.id)}@thrive-pto`,`DTSTAMP:${isoDate(now)}`];
  if(event.allDay) {
    const day=String(event.start).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Invalid all-day event');
    lines.push('DTSTART;VALUE=DATE:'+day.replace(/-/g,''));
    // Editor's end date is inclusive; the iCalendar DATE end is exclusive.
    const end=new Date(String(event.end||event.start).slice(0,10)+'T00:00:00Z');
    end.setUTCDate(end.getUTCDate()+1);
    lines.push('DTEND;VALUE=DATE:'+end.toISOString().slice(0,10).replace(/-/g,''));
  } else {
    lines.push('DTSTART:'+isoDate(event.start));
    if(event.end)lines.push('DTEND:'+isoDate(event.end));
  }
  lines.push('SUMMARY:'+icalEscape(event.title),'DESCRIPTION:'+icalEscape(event.description));
  if(event.location)lines.push('LOCATION:'+icalEscape(event.location));
  if(event.link && /^https:\/\//.test(event.link))lines.push('URL:'+icalEscape(event.link));
  lines.push('END:VEVENT','END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
