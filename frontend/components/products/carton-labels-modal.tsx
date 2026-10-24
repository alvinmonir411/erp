'use client';

import { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Package,
  Sparkles,
  RefreshCw,
  CheckCircle,
  Copy,
  Tag,
  Building2,
  ListFilter,
} from 'lucide-react';
import { BarcodeView } from '@/components/ui/barcode-view';
import { QrCodeView } from '@/components/ui/qr-code-view';
import { generateCartonLabels, getCartonLabels } from '@/lib/api/products';
import { Product, Company } from '@/types/api';
import { useToast } from '@/components/ui/toast-provider';

interface CartonLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  companies: Company[];
  initialProductId?: number;
}

export function CartonLabelsModal({
  isOpen,
  onClose,
  products,
  companies,
  initialProductId,
}: CartonLabelsModalProps) {
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState<number>(
    initialProductId || (products[0]?.id ?? 0)
  );
  const [packSize, setPackSize] = useState<number>(6);
  const [labelCount, setLabelCount] = useState<number>(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'preview'>('generate');

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  useEffect(() => {
    if (selectedProduct) {
      setPackSize(Number(selectedProduct.defaultCartonSize || 6));
    }
  }, [selectedProduct]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!selectedProductId) {
      showErrorToast('দয়া করে একটি পণ্য নির্বাচন করুন');
      return;
    }

    try {
      setIsGenerating(true);
      const res = await generateCartonLabels({
        productId: selectedProductId,
        packSize: Number(packSize),
        count: Number(labelCount),
      });

      setGeneratedLabels(res.labels || []);
      setActiveTab('preview');
      showSuccessToast(`${res.count} টি ইউনিক কার্টুন বারকোড স্টিকার তৈরি হয়েছে!`);
    } catch (err: any) {
      showErrorToast(err.message || 'কার্টুন স্টিকার তৈরি করতে ব্যর্থ হয়েছে');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-7 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                কার্টুন বারকোড স্টিকার জেনারেটর (Carton Labels)
              </h3>
              <p className="text-xs text-slate-500">
                প্রতিটি বাস্তব কার্টুনের জন্য আলাদা ইউনিক বারকোড স্টিকার তৈরি ও প্রিন্ট করুন
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switchers (Hidden in print) */}
        <div className="flex items-center gap-2 pt-3 shrink-0 print:hidden">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'generate'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            নতুন স্টিকার তৈরি করুন
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            disabled={generatedLabels.length === 0}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-40 ${
              activeTab === 'preview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            প্রিন্ট প্রিভিউ ({generatedLabels.length} টি স্টিকার)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4">
          {activeTab === 'generate' ? (
            <div className="space-y-4 max-w-xl mx-auto py-2">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  পণ্য নির্বাচন করুন <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.company?.name || 'Company'} - SKU: {p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid: Pack Size & Label Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ১ কার্টুনে কত পিস/কেজি থাকে? <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={packSize}
                      onChange={(e) => setPackSize(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {selectedProduct?.unit || 'PCS'} / কার্টুন
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    যেমন: তেল ৬ পিস, সাবান ৭২ পিস, চাল ২৫ কেজি
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    কতগুলো কার্টুন স্টিকার প্রিন্ট করবেন? <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={labelCount}
                    onChange={(e) => setLabelCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    প্রতিটি স্টিকারে আলাদা ইউনিক সিরিয়াল থাকবে
                  </p>
                </div>
              </div>

              {/* Info banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 space-y-1">
                  <strong className="font-bold">স্মার্ট কার্টুন ট্র্যাকিং:</strong>
                  <p className="text-indigo-800">
                    তৈরি হওয়া প্রতিটি স্টিকার শুধুমাত্র একটি নির্দিষ্ট কার্টুনের জন্যই কার্যকর।
                    সকালে লোডিংয়ের সময় একই কার্টুন দুবার স্ক্যান করলে সিস্টেম সাথে সাথে ওয়ার্নিং দেবে।
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all duration-200 active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{labelCount} টি ইউনিক কার্টুন স্টিকার তৈরি করুন</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Print Action Bar (Hidden in Print) */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 print:hidden">
                <div className="text-xs text-slate-600">
                  মোট <strong>{generatedLabels.length} টি</strong> ইউনিক কার্টুন স্টিকার প্রিন্টের জন্য প্রস্তুত।
                </div>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs active:scale-95 transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>স্টিকার পেপারে প্রিন্ট করুন</span>
                </button>
              </div>

              {/* Printable Sticker Grid */}
              <div
                id="carton-stickers-printable"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2 bg-slate-100 rounded-2xl print:bg-white print:p-0 print:grid-cols-2 print:gap-2"
              >
                {generatedLabels.map((label, idx) => (
                  <div
                    key={label.id || idx}
                    className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-between text-center min-h-[140px] shadow-2xs print:border-solid print:border-black print:rounded-none print:shadow-none print:break-inside-avoid"
                  >
                    {/* Company and Product */}
                    <div className="w-full border-b border-slate-100 pb-1 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase truncate">
                        {selectedProduct?.company?.name || 'Dealership'}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 leading-tight line-clamp-1">
                        {selectedProduct?.name}
                      </h4>
                    </div>

                    {/* Pack size indicator */}
                    <div className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase my-1 tracking-wider">
                      ১ কার্টুন = {label.packSize} {selectedProduct?.unit || 'PCS'}
                    </div>

                    {/* Barcode & QR Code Side-by-Side matching reference sticker */}
                    <div className="my-1.5 w-full flex items-center justify-between gap-2 px-1">
                      <div className="flex-1 flex flex-col items-center min-w-0">
                        <BarcodeView value={label.cartonCode} height={38} width={1.2} />
                      </div>
                      <div className="shrink-0 flex items-center justify-center p-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                        <QrCodeView value={label.cartonCode} size={48} />
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Serial #{idx + 1} • {new Date().toLocaleDateString('en-GB')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            বন্ধ করুন
          </button>
          {activeTab === 'preview' && (
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition"
            >
              <Printer className="h-4 w-4" />
              <span>প্রিন্ট করুন</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
