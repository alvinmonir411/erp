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
    note?: string;
    purchaseId?: number;
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
