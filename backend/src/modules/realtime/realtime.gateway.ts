import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  emitPayload(event: string, payload: any): void {
    // Socket.IO decommissioned: no-op stub preserves seamless compatibility
    // with OrdersService, DeliveryOpsService, and RecycleBinService.
  }
}
