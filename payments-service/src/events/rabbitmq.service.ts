import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel | undefined;
  private channel: amqp.Channel | undefined;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get<string>(
        'RABBITMQ_URL',
        'amqp://admin:admin@localhost:5672',
      );
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.warn(
        `RabbitMQ unavailable: ${(error as Error).message ?? error}`,
      );
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error('Error disconnecting RabbitMQ', error);
    }
  }

  getChannel(): amqp.Channel | undefined {
    return this.channel;
  }

  async publishMessage(
    exchange: string,
    routingKey: string,
    message: unknown,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not available; skip publish');
      return;
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    const buffer = Buffer.from(JSON.stringify(message));
    const published = this.channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
    });
    if (!published) {
      throw new Error(`Failed to publish to ${exchange}:${routingKey}`);
    }
    this.logger.log(`Published to ${exchange}:${routingKey}`);
  }

  async subscribeToQueue(
    queueName: string,
    exchange: string,
    routingKey: string,
    callback: (message: unknown) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    const queue = await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000,
        'x-max-length': 10000,
      },
    });
    await this.channel.bindQueue(queue.queue, exchange, routingKey);
    await this.channel.prefetch(1);
    await this.channel.consume(queue.queue, async (msg) => {
      if (!msg) {
        return;
      }
      try {
        const parsed: unknown = JSON.parse(msg.content.toString());
        await callback(parsed);
        this.channel!.ack(msg);
      } catch (error) {
        this.logger.error('Error processing queue message', error);
        this.channel!.nack(msg, false, false);
      }
    });
    this.logger.log(`Subscribed ${queueName} <- ${exchange}:${routingKey}`);
  }
}
