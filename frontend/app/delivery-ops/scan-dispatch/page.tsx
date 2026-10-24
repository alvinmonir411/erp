export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Metadata } from 'next';
import { SmartScanDispatchPage } from '@/components/delivery-ops/smart-scan-dispatch-page';

export const metadata: Metadata = {
  title: 'সকালের কার্টুন স্ক্যান ও ভ্যান লোডিং | Smart Dispatch ERP',
  description: 'বারকোড স্ক্যানার দিয়ে কার্টুন ও ফ্রি পণ্য দ্রুত লোডিং এবং চালান তৈরি।',
};

export default function Page() {
  return <SmartScanDispatchPage />;
}
