import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('system-login')
  async systemLogin(@Body() body: any, @Request() req: any) {
    const user = await this.authService.validateSystemUser(body.username, body.password, req);
    if (!user) throw new UnauthorizedException('Invalid platform credentials');
    return this.authService.login(user, req);
  }

  @Public()
  @Post('client-login')
  async clientLogin(@Body() body: any, @Request() req: any) {
    const user = await this.authService.validateClientUser(body.username, body.password, body.tenantSlug, req);
    if (!user) throw new UnauthorizedException('Invalid client credentials');
    return this.authService.login(user, req, body.tenantSlug);
  }

  @Public()
  @Post('customer-login')
  async customerLogin(@Body() body: any, @Request() req: any) {
    const user = await this.authService.validateCustomerUser(body.username, body.password, req);
    if (!user) throw new UnauthorizedException('Invalid customer credentials');
    return this.authService.login(user, req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any) {
    return this.authService.logout(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    const authHeader = req.headers?.authorization;
    const requestedBranchId = req.activeBranchId
      ? Number(req.activeBranchId)
      : req.headers?.['x-branch-id']
        ? Number(req.headers['x-branch-id'])
        : undefined;
    const user_context = await this.authService.getUserContextFromAuthHeader(authHeader, requestedBranchId);
    return { user_context };
  }
}
