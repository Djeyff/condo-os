import { NextResponse } from 'next/server';
import { validatePin, validateAdminPin } from '@/lib/auth';

export async function POST(req) {
  const body = await req.json();

  if (body.admin) {
    if (!validateAdminPin(body.pin)) {
      return NextResponse.json({ ok: false, error: 'Invalid admin PIN' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, admin: true });
    res.cookies.set('condo_admin', 'true', { httpOnly: true, maxAge: 86400 });
    res.cookies.set('condo_unit', '', { httpOnly: true, maxAge: 0 });
    return res;
  }

  const { unit, pin, unitPageId } = body;
  if (!unit) return NextResponse.json({ ok: false, error: 'Select a unit' }, { status: 400 });

  if (!validatePin(unit, pin)) {
    return NextResponse.json({ ok: false, error: 'Invalid PIN' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, unit });
  res.cookies.set('condo_unit', unit, { httpOnly: true, maxAge: 86400 });
  res.cookies.set('condo_unit_page_id', unitPageId || '', { httpOnly: true, maxAge: 86400 });
  res.cookies.set('condo_admin', '', { httpOnly: true, maxAge: 0 });
  return res;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('action') === 'logout') {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.set('condo_unit', '', { maxAge: 0 });
    res.cookies.set('condo_unit_page_id', '', { maxAge: 0 });
    res.cookies.set('condo_admin', '', { maxAge: 0 });
    res.cookies.set('condo_owner', '', { maxAge: 0 });
    return res;
  }
  return NextResponse.json({ ok: true });
}
