import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import AdminProductEditor from './AdminProductEditor';

export default function Page() {
  return <Suspense fallback={<Loading rows={6} />}><AdminProductEditor /></Suspense>;
}
