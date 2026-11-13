import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, MfaVerifyDto, RegisterDto, ResetPasswordDto, VerifyCodeDto, EmailDto, MfaLoginDto, UpdateProfileDto } from './auth.dto';
import { SessionGuard } from './session.guard';

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/v1', maxAge: 7 * 24 * 60 * 60 * 1000 });
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto, @Req() req: Request) { return this.auth.register(dto, req.ip ?? 'unknown'); }
  @Post('verify-email') verify(@Body() dto: VerifyCodeDto) { return this.auth.verifyEmail(dto.email, dto.code); }
  @Post('resend-verification') resend(@Body() body: EmailDto, @Req() req: Request) { return this.auth.resendVerification(body.email, req.ip ?? 'unknown'); }
  @Post('login') async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, req.ip ?? 'unknown');
    if ('sessionToken' in result) { res.cookie('trueman_session', result.sessionToken, cookieOptions()); return { user: result.user, mfaSetupRequired: Boolean((result as any).mfaSetupRequired) }; }
    return result;
  }
  @Post('mfa/login') async mfaLogin(@Body() body: MfaLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.completeMfaLogin(body.challenge, body.code); res.cookie('trueman_session', result.sessionToken, cookieOptions()); return { user: result.user, mfaSetupRequired: Boolean((result as any).mfaSetupRequired) };
  }
  @Post('password/forgot') forgot(@Body() body: EmailDto, @Req() req: Request) { return this.auth.requestPasswordReset(body.email, req.ip ?? 'unknown'); }
  @Post('password/reset') reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.email, dto.code, dto.newPassword); }
  @UseGuards(SessionGuard)
  @Get('me') me(@Req() req: Request) { return (req as any).auth.user; }
  @UseGuards(SessionGuard)
  @Patch('profile') updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) { return this.auth.updateProfile((req as any).auth.user.id, dto.displayName); }
  @UseGuards(SessionGuard)
  @Get('sessions') sessions(@Req() req: Request) { const auth = (req as any).auth; return this.auth.listSessions(auth.user.id, auth.sessionId); }
  @UseGuards(SessionGuard)
  @Delete('sessions/:id') revokeSession(@Req() req: Request, @Param('id') id: string) { return this.auth.revokeSession((req as any).auth.user.id, id); }
  @UseGuards(SessionGuard)
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { await this.auth.logout(req.cookies?.['trueman_session']); res.clearCookie('trueman_session', { path: '/api/v1' }); return { message: 'Signed out.' }; }
  @UseGuards(SessionGuard)
  @Post('phone/request-verification') requestPhone(@Req() req: Request) { return this.auth.requestPhoneVerification((req as any).auth.user.id); }
  @UseGuards(SessionGuard)
  @Post('phone/verify') verifyPhone(@Req() req: Request, @Body() dto: MfaVerifyDto) { return this.auth.verifyPhone((req as any).auth.user.id, dto.code); }
  @UseGuards(SessionGuard)
  @Post('mfa/setup') setup(@Req() req: Request) { return this.auth.setupMfa((req as any).auth.user.id); }
  @UseGuards(SessionGuard)
  @Post('mfa/enable') enable(@Req() req: Request, @Body() dto: MfaVerifyDto) { return this.auth.enableMfa((req as any).auth.user.id, dto.code); }
  @UseGuards(SessionGuard)
  @Post('mfa/disable') disable(@Req() req: Request, @Body() dto: MfaVerifyDto) { return this.auth.disableMfa((req as any).auth.user.id, dto.code); }
}
