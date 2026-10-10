'use client';
import { BalanceStats, PayoutTable, useBalance, usePayouts } from '@/components/Payouts';
import { Card, Empty, ErrorBox, Loading, Notice, PageHeader } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function SellerBalance() {
  const { store } = useStore();
  const balance = useBalance(store!.id);
  const payouts = usePayouts(store!.id);
  return (
    <>
      <PageHeader eyebrow={store!.name} title="Balance" description="El saldo se calcula en el servidor a partir del libro contable: ventas entregadas, menos comisiones y reembolsos, menos liquidaciones." />
      {balance.isError ? <ErrorBox error={balance.error} onRetry={() => balance.refetch()} /> : <BalanceStats b={balance.data} />}
      <div className="mt-5">
        <Notice tone="info">Las liquidaciones las programa y paga la administración por el medio acordado contigo. La plataforma no transfiere fondos de forma automática.</Notice>
      </div>
      <Card title="Liquidaciones" padded={false} className="mt-5">
        {payouts.isPending ? <Loading /> : payouts.isError ? <ErrorBox error={payouts.error} onRetry={() => payouts.refetch()} /> : !payouts.data.length ? (
          <Empty title="Aún no hay liquidaciones" body="Cuando tengas saldo disponible, la administración programará tu pago." />
        ) : <PayoutTable rows={payouts.data} />}
      </Card>
    </>
  );
}
