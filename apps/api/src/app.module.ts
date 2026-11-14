import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { SupportModule } from "./support/support.module";
import { QuotesModule } from "./quotes/quotes.module";
import { OperationsModule } from "./operations/operations.module";
import { TrackingModule } from "./tracking/tracking.module";
import { OriginMiddleware } from "./common/origin.middleware";
import { PermissionsGuard } from "./rbac/permissions.guard";
import { APP_GUARD } from "@nestjs/core";
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    SupportModule,
    QuotesModule,
    OperationsModule,
    TrackingModule,
  ],
  controllers: [HealthController],
  providers: [
    OriginMiddleware,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginMiddleware).forRoutes("*");
  }
}
