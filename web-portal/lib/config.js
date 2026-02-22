import fs from 'fs';
import path from 'path';

let _config = null;

export function getConfig() {
  if (_config) return _config;
  const configPath = path.join(process.cwd(), '..', 'config.json');
  try {
    _config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    _config = {
      building: { name: 'Condo Manager OS', units: 7, currency: 'DOP', annualBudget: 500000 },
      databases: {},
      branding: {},
    };
  }
  return _config;
}

export function getBranding() {
  const cfg = getConfig();
  return {
    name: cfg.building?.name || 'Condo Manager',
    logo: cfg.branding?.logo || null,
    primaryColor: cfg.branding?.primaryColor || '#2563eb',
    accentColor: cfg.branding?.accentColor || '#059669',
    currency: cfg.building?.currency || 'DOP',
  };
}

export function getDB(key) {
  return getConfig().databases?.[key] || null;
}
