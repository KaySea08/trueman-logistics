import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.["trueman_session"];
    if (!token) throw new UnauthorizedException("Authentication required.");
    const session = await this.auth.getSession(token);
    if (!session)
      throw new UnauthorizedException("Session expired. Please sign in again.");
    const privileged = session.user.roles.some(
      (role: string) => role !== "CUSTOMER",
    );
    const path = request.path as string;
    if (
      privileged &&
      !session.user.mfaEnabled &&
      !path.endsWith("/auth/mfa/setup") &&
      !path.endsWith("/auth/mfa/enable")
    )
      throw new UnauthorizedException(
        "Multi-factor authentication enrollment is required before using privileged access.",
      );
    if (
      session.user.mustChangePassword &&
      !path.endsWith("/auth/password/change") &&
      !path.endsWith("/auth/me") &&
      !path.endsWith("/auth/logout") &&
      !path.endsWith("/auth/mfa/setup") &&
      !path.endsWith("/auth/mfa/enable")
    )
      throw new ForbiddenException(
        "Change your temporary password before continuing.",
      );
    request.auth = session;
    return true;
  }
}
