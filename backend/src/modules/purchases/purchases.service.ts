import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Purchase,
  PurchaseItem,
  PurchaseStatus,
} from './entities/purchase.entity';
import { StockService } from '../stock/stock.service';
import { StockMovementType } from '../stock/stock.constants';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: any = {}) {
    const qb = this.purchaseRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.company', 'company')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('p.purchaseDate', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');

    if (query.companyId) {
      qb.andWhere('p.companyId = :companyId', { companyId: query.companyId });
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  async findOne(id: number) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['company', 'items', 'items.product'],
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async create(dto: any) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = manager.create(Purchase, {
        purchaseDate: new Date(dto.purchaseDate),
        invoiceNo: dto.invoiceNo,
        companyId: dto.companyId,
        supplierName: dto.supplierName,
        note: dto.note,
        status: PurchaseStatus.DRAFT,
        paidAmount: dto.paidAmount || 0,
      });

      let totalAmount = 0;
      const items: PurchaseItem[] = [];

      for (const itemDto of dto.items) {
        const lineTotal = Number(itemDto.quantity) * Number(itemDto.unitCost);
        totalAmount += lineTotal;
        items.push(
          manager.create(PurchaseItem, {
            productId: itemDto.productId,
            quantity: itemDto.quantity,
            unitCost: itemDto.unitCost,
            lineTotal,
          }),
        );
      }

      purchase.totalAmount = totalAmount;
      purchase.dueAmount = Math.max(
        0,
        totalAmount - Number(purchase.paidAmount),
      );

      const savedPurchase = await manager.save(purchase);
      for (const item of items) {
        item.purchaseId = savedPurchase.id;
      }
      await manager.save(items);

      if (dto.status === PurchaseStatus.CONFIRMED) {
        await this.confirmPurchase(savedPurchase.id, manager);
      }

      return this.findOne(savedPurchase.id);
    });
  }

  async confirmPurchase(id: number, manager?: any) {
    const exec = async (m: any) => {
      const purchase = await m.findOne(Purchase, {
        where: { id },
        relations: ['items'],
      });

      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status !== PurchaseStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT purchases can be confirmed');
      }

      for (const item of purchase.items) {
        // Update Stock
        await this.stockService.create(
          {
            productId: item.productId,
            companyId: purchase.companyId,
            type: StockMovementType.STOCK_IN,
            quantity: Number(item.quantity),
            reference: `PUR-${purchase.invoiceNo}`,
            note: `Purchase confirmed: ${purchase.invoiceNo}`,
          },
          'Admin',
          m,
        );

        // Update Product Buy Price (Latest Cost)
        await m.update(Product, item.productId, {
          buyPrice: item.unitCost,
        });
      }

      await m.update(Purchase, id, { status: PurchaseStatus.CONFIRMED });
    };

    if (manager) return exec(manager);
    return this.dataSource.transaction(exec);
  }

  async update(id: number, dto: any) {
    const existing = await this.findOne(id);
    if (existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Cannot update a confirmed purchase');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(PurchaseItem, { purchaseId: id });

      let totalAmount = 0;
      const items: PurchaseItem[] = [];

      for (const itemDto of dto.items) {
        const lineTotal = Number(itemDto.quantity) * Number(itemDto.unitCost);
        totalAmount += lineTotal;
        items.push(
          manager.create(PurchaseItem, {
            purchaseId: id,
            productId: itemDto.productId,
            quantity: itemDto.quantity,
            unitCost: itemDto.unitCost,
            lineTotal,
          }),
        );
      }

      await manager.update(Purchase, id, {
        purchaseDate: new Date(dto.purchaseDate),
        invoiceNo: dto.invoiceNo,
        companyId: dto.companyId,
        supplierName: dto.supplierName,
        note: dto.note,
        totalAmount,
        paidAmount: dto.paidAmount || 0,
        dueAmount: Math.max(0, totalAmount - Number(dto.paidAmount || 0)),
      });

      await manager.save(items);
      return this.findOne(id);
    });
  }

  async delete(id: number) {
    const purchase = await this.findOne(id);
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Cannot delete a confirmed purchase');
    }
    return this.purchaseRepository.delete(id);
  }
}
