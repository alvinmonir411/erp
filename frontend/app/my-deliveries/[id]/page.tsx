import { DeliveryUpdatePage } from '@/components/delivery/delivery-update-page';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeliveryUpdatePage orderId={Number(id)} />;
}
