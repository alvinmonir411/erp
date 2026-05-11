import { DeliveryUpdatePage } from '@/components/delivery/delivery-update-page';

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <DeliveryUpdatePage orderId={Number(orderId)} />;
}
