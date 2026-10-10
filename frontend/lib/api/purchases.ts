import { apiRequest } from './client';
import type {
  CompanyPayableLedger,
  CompanyWisePayableSummary,
  CreatePurchasePayload,
  ProductSupplySummary,
  Purchase,
  PurchasePayment,
  PurchaseQuery,
  ReceivePurchasePaymentPayload,
} from '@/types/api';

export function getPurchases(query: PurchaseQuery = {}) {
  return apiRequest<Purchase[]>('purchases', {
    query,
  });
}

export function getPurchase(id: number) {
  return apiRequest<Purchase>(`purchases/${id}`);
}

export function createPurchase(payload: CreatePurchasePayload) {
  return apiRequest<Purchase>('purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function confirmPurchase(id: number) {
  return apiRequest<Purchase>(`purchases/${id}/confirm`, {
    method: 'POST',
  });
}

export function receivePurchasePayment(
  id: number,
  payload: ReceivePurchasePaymentPayload,
) {
  return apiRequest<Purchase>(`purchases/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordCompanyPayment(
  companyId: number,
  payload: {
    amount: number;
    paymentDate?: string;
    paymentMethod?: string;
    transactionRef?: string;
    bankName?: string;
    branchName?: string;
    note?: string;
    purchaseId?: number;
    invoiceImageUrl?: string;
    invoiceImagePublicId?: string;
    productBreakdown?: Array<{
      productId?: number;
      productName?: string;
      unitPrice?: number;
      unit?: string;
      quantity?: number;
      amount?: number;
      note?: string;
    }>;
  },
) {
  return apiRequest<PurchasePayment>(`purchases/companies/${companyId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCompanyWisePayableSummary(query: PurchaseQuery = {}) {
  return apiRequest<CompanyWisePayableSummary[]>(
    'purchases/summary/company-wise-payable',
    {
      query,
    },
  );
}

export function getCompanyPayableLedger(companyId: number) {
  return apiRequest<CompanyPayableLedger>(
    `purchases/companies/${companyId}/payable-ledger`,
  );
}

export function getProductSupplySummary(companyId?: number) {
  return apiRequest<ProductSupplySummary[]>('purchases/summary/product-supplies', {
    query: companyId ? { companyId } : {},
  });
}

export function getCompanyPayments(query: PurchaseQuery = {}) {
  return apiRequest<PurchasePayment[]>('purchases/payments', {
    query,
  });
}

export function deletePurchase(id: number) {
  return apiRequest<{ success: boolean; message: string }>(`purchases/${id}`, {
    method: 'DELETE',
  });
}

export function deleteCompanyPayment(paymentId: number) {
  return apiRequest<{ success: boolean; message: string }>(`purchases/payments/${paymentId}`, {
    method: 'DELETE',
  });
}

export function resetPurchasesDemoData() {
  return apiRequest<{ success: boolean; message: string }>('purchases/reset-demo-data', {
    method: 'DELETE',
  });
}

export async function uploadPurchaseInvoiceFile(file: File): Promise<{ url: string; publicId: string }> {
  // If client-side Cloudinary preset is configured, upload directly to Cloudinary
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (cloudName && uploadPreset) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return { url: data.secure_url, publicId: data.public_id };
      }
    } catch {
      // Fallback to backend upload
    }
  }

  // Upload through backend endpoint (which handles backend Cloudinary credentials or local storage)
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const res = await fetch(`${apiUrl}/purchases/upload-invoice`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    let errMessage = 'Failed to upload invoice document';
    try {
      const errJson = await res.json();
      errMessage = errJson.message || errMessage;
    } catch {
      const text = await res.text();
      if (text) errMessage = text;
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export function updatePurchaseInvoiceImage(id: number, imageUrl: string, publicId?: string) {
  return apiRequest<Purchase>(`purchases/${id}/invoice-image`, {
    method: 'PATCH',
    body: JSON.stringify({ imageUrl, publicId }),
  });
}

export function deletePurchaseInvoiceImage(id: number) {
  return apiRequest<{ success: boolean; message: string }>(`purchases/${id}/invoice-image`, {
    method: 'DELETE',
  });
}
