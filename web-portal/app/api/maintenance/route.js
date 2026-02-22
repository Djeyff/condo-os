import { NextResponse } from 'next/server';
import { getDB } from '@/lib/config';
import { queryDB, createPage } from '@/lib/notion';

export async function POST(req) {
  const body = await req.json();
  const { description, location, priority, unit, unitPageId } = body;

  if (!description) {
    return NextResponse.json({ ok: false, error: 'Description required' }, { status: 400 });
  }

  const maintDB = getDB('maintenance');
  if (!maintDB) {
    return NextResponse.json({ ok: false, error: 'Maintenance DB not configured' }, { status: 500 });
  }

  // Get ticket number
  const existing = await queryDB(maintDB);
  const ticketNumber = String(existing.length + 1).padStart(4, '0');

  const properties = {
    'Request': { title: [{ text: { content: description } }] },
    'Status': { select: { name: 'Open' } },
    'Priority': { select: { name: priority || 'Medium' } },
    'Location': { rich_text: [{ text: { content: location || '' } }] },
    'Reported By': { rich_text: [{ text: { content: `${unit} (Web Portal)` } }] },
    'Reported Date': { date: { start: new Date().toISOString() } },
  };

  if (unitPageId) {
    properties['Unit'] = { relation: [{ id: unitPageId }] };
  }

  try {
    await createPage(maintDB, properties);
    return NextResponse.json({ ok: true, ticketNumber });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
