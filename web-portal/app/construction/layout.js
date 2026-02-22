import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ConstructionLayout({ children }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');
  return children;
}
