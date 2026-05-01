'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFinalDispatchReport } from '@/lib/api/delivery-ops';
import { PrintSummary } from '@/components/delivery-ops/print-summary';
import { LoadingBlock } from '@/components/ui/loading-block';

import { useSearchParams } from 'next/navigation';

export default function PrintFinalSettlementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parse draft dues from URL
  const draftDuesStr = searchParams.get('draftDues');
  const draftDues = draftDuesStr ? JSON.parse(draftDuesStr) : {};

  useEffect(() => {
    async function load() {
      try {
        const data = await getFinalDispatchReport(id);
        setReport(data);
        // Small delay to ensure styles are loaded before print dialog
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (error) {
        console.error('Failed to load final settlement report', error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) return <LoadingBlock label="Preparing Final Settlement Report..." />;
  if (!report) return <div className="p-8 text-center font-bold">Report not found</div>;

  return (
    <div className="min-h-screen bg-white">
      <PrintSummary report={report} mode="final" draftDues={draftDues} />
    </div>
  );
}
