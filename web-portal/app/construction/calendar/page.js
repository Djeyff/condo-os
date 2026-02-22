import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getText } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);

  let expenses=[], timesheets=[], mantCam=[], mantPlant=[], projects=[];
  try { const db=getConstructionDB('expenses'); if(db) expenses=await queryDB(db,undefined,[{property:'Date',direction:'descending'}]); } catch(e){}
  try { const db=getConstructionDB('timesheets'); if(db) timesheets=await queryDB(db,undefined,[{property:'Date',direction:'descending'}]); } catch(e){}
  try { const db=getConstructionDB('mantCamioneta'); if(db) mantCam=await queryDB(db,undefined,[{property:'Fecha',direction:'descending'}]); } catch(e){}
  try { const db=getConstructionDB('mantPlantas'); if(db) mantPlant=await queryDB(db,undefined,[{property:'Fecha',direction:'descending'}]); } catch(e){}
  try { const db=getConstructionDB('projects'); if(db) projects=await queryDB(db); } catch(e){}

  // Build calendar events
  const events = [];

  // Next camioneta service
  const latestCam = mantCam[0];
  if (latestCam) {
    const nextDate = getDate(latestCam, 'Próxima Revisión');
    if (nextDate) events.push({ date: nextDate, title: '🚛 Camioneta Maintenance', type: 'maintenance', color: 'red' });
  }

  // Project deadlines
  projects.forEach(p => {
    const end = getDate(p, 'End Date');
    const name = getTitle(p);
    const status = getSelect(p, 'Status');
    if (end && ['Active','On Site','Mobilizing'].includes(status)) {
      events.push({ date: end, title: `🏗️ ${name} — Deadline`, type: 'project', color: 'blue' });
    }
  });

  // Recent & upcoming expense dates
  const last7 = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const next30 = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);

  // Group timesheets by date for "work done" view
  const tsByDate = {};
  timesheets.forEach(t => {
    const d = getDate(t, 'Date');
    if (!d || d < last7) return;
    if (!tsByDate[d]) tsByDate[d] = { hours: 0, tasks: [] };
    tsByDate[d].hours += getNumber(t, 'Hours') || 0;
    tsByDate[d].tasks.push(getTitle(t));
  });

  Object.entries(tsByDate).forEach(([date, data]) => {
    events.push({ date, title: `⏱️ ${data.hours}h — ${data.tasks.slice(0,3).join(', ')}`, type: 'timesheet', color: 'gold' });
  });

  // Sort events
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Build weekly view (next 4 weeks)
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      const dateStr = day.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        dayNum: day.getDate(),
        dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: dateStr === todayStr,
        events: events.filter(e => e.date === dateStr),
      });
    }
    weeks.push(days);
  }

  const colorMap = { red: 'bg-red-400', blue: 'bg-blue-400', gold: '', green: 'bg-emerald-400' };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Calendar & Schedule</h2>

        {/* 4-Week Grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="mb-6">
            <p className="text-xs font-semibold mb-2" style={{ color: '#64748b' }}>
              {wi === 0 ? 'This Week' : wi === 1 ? 'Next Week' : `Week ${wi + 1}`}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {week.map((day, di) => (
                <div key={di} className="rounded-lg p-2 min-h-[80px]"
                  style={{
                    background: day.isToday ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                    border: day.isToday ? '1px solid rgba(212,168,83,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#64748b' }}>{day.dayName}</span>
                    <span className={`text-sm font-bold ${day.isToday ? '' : 'text-white'}`}
                      style={day.isToday ? { color: '#d4a853' } : {}}>{day.dayNum}</span>
                  </div>
                  {day.events.map((ev, ei) => (
                    <div key={ei} className="mb-1 rounded px-1.5 py-0.5 text-xs truncate"
                      style={{
                        background: ev.color === 'gold' ? 'rgba(212,168,83,0.15)' : ev.color === 'red' ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)',
                        color: ev.color === 'gold' ? '#d4a853' : ev.color === 'red' ? '#fca5a5' : '#93c5fd',
                      }}>
                      {ev.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Upcoming Events List */}
        <div className="rounded-xl overflow-hidden mt-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-lg font-semibold text-white">All Events</h3>
          </div>
          <div>
            {events.filter(e => e.date >= todayStr).map((ev, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full"
                    style={{ background: ev.color === 'gold' ? '#d4a853' : ev.color === 'red' ? '#f87171' : '#60a5fa' }}></div>
                  <div>
                    <p className="text-sm text-white">{ev.title}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{ev.date}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{ev.type}</span>
              </div>
            ))}
            {events.filter(e => e.date >= todayStr).length === 0 && (
              <p className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>No upcoming events.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
