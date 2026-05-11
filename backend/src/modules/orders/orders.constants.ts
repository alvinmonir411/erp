export enum DiscountType {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  ASSIGNED = 'ASSIGNED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  DELIVERED = 'DELIVERED',
  DELIVERY_COMPLETED = 'DELIVERY_COMPLETED',
  RETURNED_PARTIAL = 'RETURNED_PARTIAL',
  CANCELLED = 'CANCELLED',
  PARTIAL_DUE = 'PARTIAL_DUE',
  SETTLED = 'SETTLED',
}

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}
