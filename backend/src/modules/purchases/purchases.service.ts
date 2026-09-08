import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Purchase,
  PurchaseItem,
  PurchaseStatus,
} from './entities/purchase.entity';
import { CompanyPayment, PaymentMethod } from './entities/company-payment.entity';
import { Company } from '../companies/entities/company.entity';
import { Product } from '../products/entities/product.entity';
import { StockService } from '../stock/stock.service';
import { StockMovementType } from '../stock/stock.constants';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
    @InjectRepository(CompanyPayment)
    private readonly paymentRepository: Repository<CompanyPayment>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
  ) {}

  private safeNum(val: any): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
  }

  async findAll(query: any = {}) {
    const qb = this.purchaseRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.company', 'company')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('p.payments', 'payments')
      .orderBy('p.purchaseDate', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');

    if (query.companyId) {
      qb.andWhere('p.companyId = :companyId', { companyId: Number(query.companyId) });
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(p.invoiceNo ILIKE :search OR p.supplierName ILIKE :search OR company.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.fromDate) {
      qb.andWhere('p.purchaseDate >= :fromDate', { fromDate: query.fromDate });
    }

    if (query.toDate) {
      qb.andWhere('p.purchaseDate <= :toDate', { toDate: query.toDate });
    }

    const items = await qb.getMany();
    return items;
  }

  async findOne(id: number) {
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      throw new NotFoundException(`Invalid purchase ID: ${id}`);
    }
    try {
      const purchase = await this.purchaseRepository.findOne({
        where: { id: numId },
        relations: ['company', 'items', 'items.product', 'payments'],
      });
      if (purchase) return purchase;
    } catch {
      // Ignore relation join errors if any
    }

    const simple = await this.purchaseRepository.findOne({ where: { id: numId } });
    if (!simple) throw new NotFoundException(`Purchase invoice #${id} not found`);
    return simple;
  }

  async create(dto: any, user?: any) {
    let createdId: number;

    await this.dataSource.transaction(async (manager) => {
      let paidAmount = this.safeNum(dto.paidAmount);
      const paymentId = dto.paymentId ? Number(dto.paymentId) : null;
      let linkedPayment: CompanyPayment | null = null;

      if (paymentId) {
        linkedPayment = await manager.findOne(CompanyPayment, {
          where: { id: paymentId },
        });
        if (linkedPayment) {
          if (dto.paidAmount === undefined || dto.paidAmount === null || dto.paidAmount === '') {
            paidAmount = this.safeNum(linkedPayment.amount);
          }
        }
      }

      const isConfirmed =
        dto.status === PurchaseStatus.CONFIRMED || dto.confirmStockIn === true;

      const purchase = manager.create(Purchase, {
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
        invoiceNo:
          dto.invoiceNo?.trim() ||
          dto.referenceNo?.trim() ||
          `INV-${Date.now().toString().slice(-6)}`,
        companyId: Number(dto.companyId),
        supplierName: dto.supplierName || null,
        note: dto.note || null,
        status: isConfirmed ? PurchaseStatus.CONFIRMED : PurchaseStatus.DRAFT,
        paidAmount,
      });

      let totalAmount = 0;
      const items: PurchaseItem[] = [];

      for (const itemDto of dto.items || []) {
        const qty = this.safeNum(itemDto.quantity);
        const cost = this.safeNum(
          itemDto.unitCost ?? itemDto.cost ?? itemDto.buyPrice ?? itemDto.unitPrice,
        );
        const lineTotal = qty * cost;
        totalAmount += lineTotal;
        items.push(
          manager.create(PurchaseItem, {
            productId: Number(itemDto.productId),
            quantity: qty,
            unitCost: cost,
            lineTotal,
          }),
        );
      }

      purchase.totalAmount = totalAmount;
      purchase.dueAmount = Math.max(0, totalAmount - paidAmount);

      const savedPurchase = await manager.save(purchase);
      for (const item of items) {
        item.purchaseId = savedPurchase.id;
      }
      await manager.save(items);

      // Link payment if provided
      if (linkedPayment) {
        await manager.update(CompanyPayment, linkedPayment.id, {
          purchaseId: savedPurchase.id,
        });
      } else if (paidAmount > 0) {
        const payment = manager.create(CompanyPayment, {
          companyId: savedPurchase.companyId,
          purchaseId: savedPurchase.id,
          amount: paidAmount,
          paymentDate: savedPurchase.purchaseDate,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          transactionRef: dto.transactionRef || `INV-${savedPurchase.invoiceNo}`,
          note:
            dto.paymentNote || `Initial settlement for Invoice #${savedPurchase.invoiceNo}`,
          createdByName: user?.name || user?.username || 'Admin',
          createdById: user?.id || null,
        });
        await manager.save(payment);
      }

      // If CONFIRMED, update inventory and buyPrice immediately
      if (isConfirmed) {
        for (const item of items) {
          // Stock In
          await this.stockService.create(
            {
              productId: item.productId,
              companyId: savedPurchase.companyId,
              type: StockMovementType.STOCK_IN,
              quantity: Number(item.quantity),
              reference: `PUR-${savedPurchase.invoiceNo}`,
              note: `Purchase confirmed: Invoice #${savedPurchase.invoiceNo}`,
            },
            user?.name || user?.username || 'Admin',
            manager,
          );

          // Update Product Buy Price with latest purchase cost
          if (Number(item.unitCost) > 0) {
            await manager.update(Product, item.productId, {
              buyPrice: Number(item.unitCost),
            });
          }
        }
      }

      createdId = savedPurchase.id;
    });

    return this.findOne(createdId!);
  }

  async confirmPurchase(id: number, manager?: any) {
    const exec = async (m: any) => {
      const purchase = await m.findOne(Purchase, {
        where: { id },
        relations: ['items', 'items.product', 'company'],
      });

      if (!purchase) throw new NotFoundException('Purchase invoice not found');
      if (purchase.status === PurchaseStatus.CONFIRMED) {
        return purchase;
      }

      for (const item of purchase.items || []) {
        // Stock In
        await this.stockService.create(
          {
            productId: item.productId,
            companyId: purchase.companyId,
            type: StockMovementType.STOCK_IN,
            quantity: Number(item.quantity),
            reference: `PUR-${purchase.invoiceNo}`,
            note: `Purchase confirmed: Invoice #${purchase.invoiceNo}`,
          },
          'Admin',
          m,
        );

        // Update Product Buy Price with latest purchase cost
        if (Number(item.unitCost) > 0) {
          await m.update(Product, item.productId, {
            buyPrice: Number(item.unitCost),
          });
        }
      }

      await m.update(Purchase, id, { status: PurchaseStatus.CONFIRMED });
      return m.findOne(Purchase, {
        where: { id },
        relations: ['items', 'items.product', 'company'],
      });
    };

    if (manager) return exec(manager);
    return this.dataSource.transaction(exec);
  }

  async update(id: number, dto: any) {
    const existing = await this.findOne(id);
    if (existing.status === PurchaseStatus.CONFIRMED) {
      throw new BadRequestException('Cannot modify an already confirmed purchase invoice');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(PurchaseItem, { purchaseId: id });

      let totalAmount = 0;
      const items: PurchaseItem[] = [];

      for (const itemDto of dto.items || []) {
        const qty = this.safeNum(itemDto.quantity);
        const cost = this.safeNum(itemDto.unitCost ?? itemDto.cost ?? itemDto.buyPrice);
        const lineTotal = qty * cost;
        totalAmount += lineTotal;
        items.push(
          manager.create(PurchaseItem, {
            purchaseId: id,
            productId: Number(itemDto.productId),
            quantity: qty,
            unitCost: cost,
            lineTotal,
          }),
        );
      }

      const paidAmount = this.safeNum(dto.paidAmount ?? existing.paidAmount);
      await manager.update(Purchase, id, {
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : existing.purchaseDate,
        invoiceNo: dto.invoiceNo?.trim() || existing.invoiceNo,
        companyId: dto.companyId ? Number(dto.companyId) : existing.companyId,
        supplierName: dto.supplierName ?? existing.supplierName,
        note: dto.note ?? existing.note,
        totalAmount,
        paidAmount,
        dueAmount: Math.max(0, totalAmount - paidAmount),
      });

      await manager.save(items);
      return this.findOne(id);
    });
  }

  async delete(id: number) {
    if (!id || isNaN(id) || id <= 0) {
      throw new BadRequestException(`Invalid purchase ID: ${id}`);
    }
    const purchase = await this.findOne(id);
    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      // If confirmed, adjust stock back safely
      if (purchase.status === PurchaseStatus.CONFIRMED && purchase.items?.length) {
        for (const item of purchase.items) {
          const product = await manager.findOne(Product, {
            where: { id: item.productId },
          });
          if (product) {
            const currentStock = this.safeNum(product.currentStock);
            const qty = this.safeNum(item.quantity);
            await manager.update(Product, product.id, {
              currentStock: Math.max(0, currentStock - qty),
            });
          }
        }
      }

      // Delete payments tied to this purchase
      await manager.query('DELETE FROM "company_payments" WHERE "purchaseId" = $1', [id]);

      // Delete items
      await manager.query('DELETE FROM "purchase_items" WHERE "purchaseId" = $1', [id]);

      // Delete purchase
      await manager.query('DELETE FROM "purchases" WHERE "id" = $1', [id]);

      return { success: true, message: `Purchase invoice #${purchase.invoiceNo || id} deleted successfully` };
    });
  }

  async deletePayment(paymentId: number) {
    if (!paymentId || isNaN(paymentId) || paymentId <= 0) {
      throw new BadRequestException(`Invalid payment ID: ${paymentId}`);
    }
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      if (payment.purchaseId) {
        const purchase = await manager.findOne(Purchase, {
          where: { id: payment.purchaseId },
        });
        if (purchase) {
          const paid = Math.max(0, this.safeNum(purchase.paidAmount) - this.safeNum(payment.amount));
          const due = Math.max(0, this.safeNum(purchase.totalAmount) - paid);
          await manager.update(Purchase, purchase.id, {
            paidAmount: paid,
            dueAmount: due,
          });
        }
      }

      await manager.query('DELETE FROM "company_payments" WHERE "id" = $1', [paymentId]);
      return { success: true, message: `Payment of ${payment.amount} deleted successfully` };
    });
  }

  async resetDemoData() {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM "company_payments"');
      await manager.query('DELETE FROM "purchase_items"');
      await manager.query('DELETE FROM "purchases"');
      return { success: true, message: 'All purchases and company payments have been reset to 0' };
    });
  }

  /**
   * 📊 Company-Wise Payable & Purchases Summary
   * Returns total goods received (purchases), total paid, and current payable due per company
   */
  async getCompanyWisePayableSummary(query: any = {}) {
    // 1. Fetch all companies
    const companies = await this.companyRepository.find({
      order: { name: 'ASC' },
    });

    // 2. Aggregate purchases by company
    const purchaseQb = this.purchaseRepository
      .createQueryBuilder('p')
      .select('p.companyId', 'companyId')
      .addSelect('COUNT(p.id)', 'purchaseCount')
      .addSelect('SUM(COALESCE(p.totalAmount, 0))', 'totalPurchaseAmount')
      .addSelect('SUM(COALESCE(p.paidAmount, 0))', 'totalPaidAmount')
      .addSelect('SUM(COALESCE(p.dueAmount, 0))', 'totalPayableAmount')
      .addSelect('MAX(p.purchaseDate)', 'lastPurchaseDate')
      .where("p.status <> 'CANCELLED'");

    if (query.fromDate) {
      purchaseQb.andWhere('p.purchaseDate >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      purchaseQb.andWhere('p.purchaseDate <= :toDate', { toDate: query.toDate });
    }

    purchaseQb.groupBy('p.companyId');
    const purchaseAggs = await purchaseQb.getRawMany();

    // 3. Aggregate payments by company
    const paymentQb = this.paymentRepository
      .createQueryBuilder('pay')
      .select('pay.companyId', 'companyId')
      .addSelect('COUNT(pay.id)', 'paymentCount')
      .addSelect('SUM(COALESCE(pay.amount, 0))', 'totalPayments')
      .addSelect('MAX(pay.paymentDate)', 'lastPaymentDate');

    if (query.fromDate) {
      paymentQb.andWhere('pay.paymentDate >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      paymentQb.andWhere('pay.paymentDate <= :toDate', { toDate: query.toDate });
    }

    paymentQb.groupBy('pay.companyId');
    const paymentAggs = await paymentQb.getRawMany();

    // 4. Map summaries
    const purchaseMap = new Map<number, any>();
    for (const p of purchaseAggs) {
      purchaseMap.set(Number(p.companyId), {
        purchaseCount: this.safeNum(p.purchaseCount),
        totalPurchaseAmount: this.safeNum(p.totalPurchaseAmount),
        totalPaidAmount: this.safeNum(p.totalPaidAmount),
        totalPayableAmount: this.safeNum(p.totalPayableAmount),
        lastPurchaseDate: p.lastPurchaseDate,
      });
    }

    const paymentMap = new Map<number, any>();
    for (const pay of paymentAggs) {
      paymentMap.set(Number(pay.companyId), {
        paymentCount: this.safeNum(pay.paymentCount),
        totalPayments: this.safeNum(pay.totalPayments),
        lastPaymentDate: pay.lastPaymentDate,
      });
    }

    return companies.map((c) => {
      const pStats = purchaseMap.get(c.id) || {
        purchaseCount: 0,
        totalPurchaseAmount: 0,
        totalPaidAmount: 0,
        totalPayableAmount: 0,
        lastPurchaseDate: null,
      };
      const payStats = paymentMap.get(c.id) || {
        paymentCount: 0,
        totalPayments: 0,
        lastPaymentDate: null,
      };

      // Total paid is highest of recorded direct payments or invoice paid amounts
      const actualTotalPaid = Math.max(pStats.totalPaidAmount, payStats.totalPayments);
      const balance = pStats.totalPurchaseAmount - actualTotalPaid;
      const payableDue = balance > 0 ? balance : 0;
      const advancePaid = balance < 0 ? Math.abs(balance) : 0;
      const balanceType = balance > 0 ? 'PAYABLE' : balance < 0 ? 'ADVANCE' : 'SETTLED';

      return {
        companyId: c.id,
        companyName: c.name,
        companyCode: (c as any).code || null,
        phone: (c as any).phone || null,
        purchaseCount: pStats.purchaseCount,
        totalPurchaseAmount: pStats.totalPurchaseAmount,
        totalPaidAmount: actualTotalPaid,
        totalPayableAmount: payableDue,
        advanceAmount: advancePaid,
        balanceType,
        lastPurchaseDate: pStats.lastPurchaseDate,
        lastPaymentDate: payStats.lastPaymentDate,
      };
    });
  }

  /**
   * 🏢 Detailed Company Payable Ledger (কোম্পানির খতিয়ান ও পেমেন্ট হিস্ট্রি)
   */
  async getCompanyPayableLedger(companyId: number) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found');

    // 1. Fetch all purchases for this company
    const purchases = await this.purchaseRepository.find({
      where: { companyId },
      relations: ['items', 'items.product'],
      order: { purchaseDate: 'DESC', createdAt: 'DESC' },
    });

    // 2. Fetch all payments made to this company
    const payments = await this.paymentRepository.find({
      where: { companyId },
      relations: ['purchase'],
      order: { paymentDate: 'DESC', createdAt: 'DESC' },
    });

    // 3. Product-Wise Summary for this Company
    const productSupplyQb = this.purchaseItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.purchase', 'p')
      .innerJoin('item.product', 'prod')
      .select('prod.id', 'productId')
      .addSelect('prod.name', 'productName')
      .addSelect('prod.unit', 'unit')
      .addSelect('prod.currentStock', 'currentStock')
      .addSelect('prod.buyPrice', 'latestBuyPrice')
      .addSelect('SUM(COALESCE(item.quantity, 0))', 'totalQuantity')
      .addSelect('SUM(COALESCE(item.lineTotal, 0))', 'totalCost')
      .addSelect('COUNT(DISTINCT p.id)', 'purchaseCount')
      .addSelect('MAX(p.purchaseDate)', 'lastPurchaseDate')
      .where('p.companyId = :companyId', { companyId })
      .andWhere("p.status <> 'CANCELLED'")
      .groupBy('prod.id')
      .addGroupBy('prod.name')
      .addGroupBy('prod.unit')
      .addGroupBy('prod.currentStock')
      .addGroupBy('prod.buyPrice')
      .orderBy('SUM(COALESCE(item.lineTotal, 0))', 'DESC');

    const productSupplyData = await productSupplyQb.getRawMany();

    const productSummary = productSupplyData.map((p) => {
      const totalQty = this.safeNum(p.totalQuantity);
      const totalCost = this.safeNum(p.totalCost);
      const avgUnitCost = totalQty > 0 ? totalCost / totalQty : this.safeNum(p.latestBuyPrice);
      return {
        productId: Number(p.productId),
        productName: p.productName,
        unit: p.unit || 'Pcs',
        currentStock: this.safeNum(p.currentStock),
        latestBuyPrice: this.safeNum(p.latestBuyPrice),
        totalQuantity: totalQty,
        totalCost: totalCost,
        avgUnitCost: Number(avgUnitCost.toFixed(2)),
        purchaseCount: this.safeNum(p.purchaseCount),
        lastPurchaseDate: p.lastPurchaseDate,
      };
    });

    // 4. Calculate Ledger Totals
    const totalPurchases = purchases
      .filter((p) => p.status !== PurchaseStatus.CANCELLED)
      .reduce((sum, p) => sum + this.safeNum(p.totalAmount), 0);

    const totalInvoicePaid = purchases
      .filter((p) => p.status !== PurchaseStatus.CANCELLED)
      .reduce((sum, p) => sum + this.safeNum(p.paidAmount), 0);

    const totalDirectPayments = payments.reduce((sum, pay) => sum + this.safeNum(pay.amount), 0);
    const totalPaid = Math.max(totalInvoicePaid, totalDirectPayments);
    const balance = totalPurchases - totalPaid;
    const currentPayable = balance > 0 ? balance : 0;
    const advanceBalance = balance < 0 ? Math.abs(balance) : 0;
    const status = balance > 0 ? 'DUE_TO_COMPANY' : balance < 0 ? 'ADVANCE_TO_COMPANY' : 'SETTLED';

    return {
      company: {
        id: company.id,
        name: company.name,
        code: (company as any).code || null,
        phone: (company as any).phone || null,
        address: (company as any).address || null,
      },
      summary: {
        totalPurchases,
        totalPaid,
        currentPayable,
        advanceBalance,
        status,
        purchaseCount: purchases.length,
        paymentCount: payments.length,
        totalProductsSupplied: productSummary.length,
      },
      payablePurchases: purchases.map((p) => ({
        id: p.id,
        invoiceNo: p.invoiceNo,
        purchaseDate: p.purchaseDate,
        totalAmount: this.safeNum(p.totalAmount),
        paidAmount: this.safeNum(p.paidAmount),
        payableAmount: Math.max(0, this.safeNum(p.totalAmount) - this.safeNum(p.paidAmount)),
        status: p.status,
        supplierName: p.supplierName,
        note: p.note,
        createdAt: p.createdAt,
        items: (p.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name || `Product #${item.productId}`,
          quantity: this.safeNum(item.quantity),
          unitCost: this.safeNum(item.unitCost),
          lineTotal: this.safeNum(item.lineTotal),
          unit: item.product?.unit || 'Pcs',
        })),
      })),
      paymentHistory: payments.map((pay) => ({
        id: pay.id,
        amount: this.safeNum(pay.amount),
        paymentDate: pay.paymentDate,
        paymentMethod: pay.paymentMethod,
        transactionRef: pay.transactionRef,
        note: pay.note,
        productBreakdown: pay.productBreakdown || null,
        purchaseId: pay.purchaseId,
        purchaseInvoiceNo: pay.purchase?.invoiceNo || null,
        createdByName: pay.createdByName,
        createdAt: pay.createdAt,
      })),
      productSummary,
    };
  }

  /**
   * 💳 Record Payment to Company (কোম্পানিকে টাকা পরিশোধ এন্ট্রি)
   */
  async recordCompanyPayment(companyId: number, dto: any, user?: any) {
    const amount = this.safeNum(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found');

    return this.dataSource.transaction(async (manager) => {
      let linkedPurchase: Purchase | null = null;
      if (dto.purchaseId) {
        linkedPurchase = await manager.findOne(Purchase, {
          where: { id: Number(dto.purchaseId), companyId },
        });
      }

      // Format note with product breakdown if provided
      let finalNote = dto.note || '';
      const breakdownList = Array.isArray(dto.productBreakdown)
        ? dto.productBreakdown.filter(
            (b: any) => b && (b.productName || b.productId || b.amount),
          )
        : [];

      if (breakdownList.length > 0) {
        const breakdownParts = breakdownList.map((b: any, idx: number) => {
          const name = b.productName || `Product #${b.productId}`;
          const rate = b.unitPrice ? ` @ ৳${b.unitPrice}` : '';
          const qty = b.quantity ? ` (${b.quantity} ${b.unit || 'টি'}${rate})` : '';
          const amt = b.amount ? ` - ৳${b.amount}` : '';
          const itemNote = b.note ? ` [${b.note}]` : '';
          return `${idx + 1}. ${name}${qty}${amt}${itemNote}`;
        });
        const breakdownSummary = breakdownParts.join(' | ');
        if (finalNote) {
          finalNote = `${finalNote} [পণ্যসমূহ: ${breakdownSummary}]`;
        } else {
          finalNote = `পণ্য বাবদ পরিশোধ: ${breakdownSummary}`;
        }
      }

      if (!finalNote) {
        finalNote = linkedPurchase
          ? `Payment for Invoice #${linkedPurchase.invoiceNo}`
          : `Payment to ${company.name}`;
      }

      // 1. Create Payment Record
      const payment = manager.create(CompanyPayment, {
        companyId,
        purchaseId: linkedPurchase ? linkedPurchase.id : null,
        amount,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
        transactionRef: dto.transactionRef || null,
        note: finalNote,
        productBreakdown: breakdownList.length > 0 ? breakdownList : null,
        createdByName: user?.name || user?.username || 'Admin',
        createdById: user?.id || null,
      });

      const savedPayment = await manager.save(payment);

      // 2. Adjust Purchase invoice(s) due balance
      if (linkedPurchase) {
        const newPaid = this.safeNum(linkedPurchase.paidAmount) + amount;
        const newDue = Math.max(0, this.safeNum(linkedPurchase.totalAmount) - newPaid);
        await manager.update(Purchase, linkedPurchase.id, {
          paidAmount: newPaid,
          dueAmount: newDue,
        });
      } else {
        // Automatically allocate payment to oldest outstanding purchases for this company
        let remainingToAllocate = amount;
        const unpaidPurchases = await manager.find(Purchase, {
          where: { companyId },
          order: { purchaseDate: 'ASC', createdAt: 'ASC' },
        });

        for (const p of unpaidPurchases) {
          if (remainingToAllocate <= 0) break;
          const currentDue = Math.max(0, this.safeNum(p.totalAmount) - this.safeNum(p.paidAmount));
          if (currentDue > 0) {
            const allocation = Math.min(currentDue, remainingToAllocate);
            const newPaid = this.safeNum(p.paidAmount) + allocation;
            const newDue = Math.max(0, this.safeNum(p.totalAmount) - newPaid);
            await manager.update(Purchase, p.id, {
              paidAmount: newPaid,
              dueAmount: newDue,
            });
            remainingToAllocate -= allocation;
          }
        }
      }

      return savedPayment;
    });
  }

  /**
   * 📦 Product Supply Summary (সব পণ্য বা নির্দিষ্ট কোম্পানির কোন কোন প্রোডাক্ট কত টাকার এসেছে)
   */
  async getProductSupplySummary(companyId?: number) {
    const qb = this.purchaseItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.purchase', 'p')
      .innerJoin('item.product', 'prod')
      .leftJoin('prod.company', 'comp')
      .select('prod.id', 'productId')
      .addSelect('prod.name', 'productName')
      .addSelect('prod.unit', 'unit')
      .addSelect('prod.currentStock', 'currentStock')
      .addSelect('prod.buyPrice', 'latestBuyPrice')
      .addSelect('comp.id', 'companyId')
      .addSelect('comp.name', 'companyName')
      .addSelect('SUM(COALESCE(item.quantity, 0))', 'totalQuantityReceived')
      .addSelect('SUM(COALESCE(item.lineTotal, 0))', 'totalCostValue')
      .addSelect('COUNT(DISTINCT p.id)', 'purchaseCount')
      .addSelect('MAX(p.purchaseDate)', 'lastPurchaseDate')
      .where("p.status <> 'CANCELLED'");

    if (companyId) {
      qb.andWhere('p.companyId = :companyId', { companyId: Number(companyId) });
    }

    qb.groupBy('prod.id')
      .addGroupBy('prod.name')
      .addGroupBy('prod.unit')
      .addGroupBy('prod.currentStock')
      .addGroupBy('prod.buyPrice')
      .addGroupBy('comp.id')
      .addGroupBy('comp.name')
      .orderBy('SUM(COALESCE(item.lineTotal, 0))', 'DESC');

    const data = await qb.getRawMany();

    return data.map((row, idx) => {
      const totalQty = this.safeNum(row.totalQuantityReceived);
      const totalCost = this.safeNum(row.totalCostValue);
      const avgUnitCost = totalQty > 0 ? totalCost / totalQty : this.safeNum(row.latestBuyPrice);

      return {
        rank: idx + 1,
        productId: Number(row.productId),
        productName: row.productName,
        companyId: Number(row.companyId),
        companyName: row.companyName || 'Unknown',
        unit: row.unit || 'Pcs',
        currentStock: this.safeNum(row.currentStock),
        latestBuyPrice: this.safeNum(row.latestBuyPrice),
        totalQuantityReceived: totalQty,
        totalCostValue: totalCost,
        avgUnitCost: Number(avgUnitCost.toFixed(2)),
        purchaseCount: this.safeNum(row.purchaseCount),
        lastPurchaseDate: row.lastPurchaseDate,
      };
    });
  }

  /**
   * 📜 Payment History (কোম্পানিকে দেওয়া সমস্ত পেমেন্টের খতিয়ান)
   */
  async getPaymentHistory(query: any = {}) {
    const qb = this.paymentRepository
      .createQueryBuilder('pay')
      .leftJoinAndSelect('pay.company', 'company')
      .leftJoinAndSelect('pay.purchase', 'purchase')
      .orderBy('pay.paymentDate', 'DESC')
      .addOrderBy('pay.createdAt', 'DESC');

    if (query.companyId) {
      qb.andWhere('pay.companyId = :companyId', { companyId: Number(query.companyId) });
    }

    if (query.fromDate) {
      qb.andWhere('pay.paymentDate >= :fromDate', { fromDate: query.fromDate });
    }

    if (query.toDate) {
      qb.andWhere('pay.paymentDate <= :toDate', { toDate: query.toDate });
    }

    return qb.getMany();
  }
}
