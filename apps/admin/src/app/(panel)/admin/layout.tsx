import { Guard } from '@/components/Guard';
import { Shell } from '@/components/Shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard need="admin">
      <Shell area="admin">{children}</Shell>
    </Guard>
  );
}
