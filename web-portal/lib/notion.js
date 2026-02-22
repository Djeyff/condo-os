import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function queryDB(dbId, filter = undefined, sorts = undefined, pageSize = 100) {
  if (!dbId) return [];
  const results = [];
  let cursor;
  do {
    const params = { database_id: dbId, page_size: pageSize };
    if (filter) params.filter = filter;
    if (sorts) params.sorts = sorts;
    if (cursor) params.start_cursor = cursor;
    const res = await notion.databases.query(params);
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return results;
}

export async function createPage(dbId, properties) {
  return notion.pages.create({ parent: { database_id: dbId }, properties });
}

export async function updatePage(pageId, properties) {
  return notion.pages.update({ page_id: pageId, properties });
}

// Property extractors
export function getTitle(page) {
  for (const p of Object.values(page.properties || {})) {
    if (p.type === 'title') return (p.title || []).map(t => t.plain_text).join('');
  }
  return '';
}

export function getNumber(page, key) {
  const p = page.properties?.[key];
  if (!p) return null;
  if (p.type === 'number') return p.number;
  if (p.type === 'formula') return p.formula?.type === 'number' ? p.formula.number : null;
  if (p.type === 'rollup') return p.rollup?.type === 'number' ? p.rollup.number : null;
  return null;
}

export function getText(page, key) {
  const p = page.properties?.[key];
  if (!p) return '';
  if (p.type === 'rich_text') return (p.rich_text || []).map(t => t.plain_text).join('');
  if (p.type === 'title') return (p.title || []).map(t => t.plain_text).join('');
  if (p.type === 'email') return p.email || '';
  if (p.type === 'phone_number') return p.phone_number || '';
  return '';
}

export function getSelect(page, key) {
  const p = page.properties?.[key];
  return p?.type === 'select' ? p.select?.name || '' : '';
}

export function getDate(page, key) {
  const p = page.properties?.[key];
  return p?.type === 'date' ? p.date?.start || null : null;
}

export function getRelationIds(page, key) {
  const p = page.properties?.[key];
  return p?.type === 'relation' ? (p.relation || []).map(r => r.id) : [];
}

export function getCheckbox(page, key) {
  const p = page.properties?.[key];
  return p?.type === 'checkbox' ? p.checkbox : false;
}

export { notion };
