import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnModuleDestroy,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway(5003, {
  cors: {
    origin: '*',
  },
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log('Websocket Gateway Initialized on port 5003');
  }

  onModuleDestroy() {
    if (this.server) {
      try {
        this.server.close();
      } catch (err) {
        // Ignore close error on shutdown
      }
    }
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitPayload(event: string, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
      this.logger.log(`Emitted event ${event} to all connected clients`);
    }
  }
}
