import { cookies } from 'next/headers';
import { getConfig } from './config';

export async function getSession() {
  const cookieStore = await cookies();
  const unit = cookieStore.get('condo_unit')?.value || null;
  const unitPageId = cookieStore.get('condo_unit_page_id')?.value || null;
  const owner = cookieStore.get('condo_owner')?.value || null;
  const isAdmin = cookieStore.get('condo_admin')?.value === 'true';
  return { unit, unitPageId, owner, isAdmin };
}

export function validatePin(unit, pin) {
  const cfg = getConfig();
  const pins = cfg.portal?.pins || {};
  // Demo mode: if no PINs configured, auto-authenticate
  if (Object.keys(pins).length === 0) return true;
  return pins[unit] === pin;
}

export function validateAdminPin(pin) {
  return pin === (process.env.ADMIN_PIN || '0000');
}
