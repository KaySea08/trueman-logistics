import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import Redis from "ioredis";
import { EMPTY, interval, map, merge, Observable, Subject } from "rxjs";
import { REDIS } from "../redis/redis.module";

const ADMIN_QUOTE_CHANNEL = "trueman:admin:quote-requests";

@Injectable()
export class QuoteRequestEventsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(QuoteRequestEventsService.name);
  private readonly subscriber: Redis | null;
  private readonly events = new Subject<MessageEvent>();

  constructor(@Inject(REDIS) redis: Redis) {
    this.subscriber =
      process.env.QUOTE_WORKER_ENABLED === "true" ? null : redis.duplicate();
  }

  async onModuleInit() {
    if (!this.subscriber) return;
    this.subscriber.on("message", (channel, message) => {
      if (channel !== ADMIN_QUOTE_CHANNEL) return;
      try {
        this.events.next({
          type: "quote-request",
          data: JSON.parse(message) as Record<string, unknown>,
        });
      } catch {
        this.logger.warn("Discarded malformed quote-request notification.");
      }
    });
    try {
      await this.subscriber.subscribe(ADMIN_QUOTE_CHANNEL);
    } catch {
      this.logger.error(
        "Quote-request SSE subscriber could not connect to Redis.",
      );
    }
  }

  stream(includeRequestEvents = true): Observable<MessageEvent> {
    const heartbeat = interval(20_000).pipe(
      map(() => ({ type: "heartbeat", data: "keepalive" }) as MessageEvent),
    );
    return merge(
      includeRequestEvents ? this.events.asObservable() : EMPTY,
      heartbeat,
    );
  }

  async onModuleDestroy() {
    this.events.complete();
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(ADMIN_QUOTE_CHANNEL);
    } finally {
      this.subscriber.disconnect();
    }
  }
}
