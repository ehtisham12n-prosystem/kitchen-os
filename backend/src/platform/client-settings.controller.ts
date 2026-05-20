import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { PlatformService } from './platform.service';

@Controller('v1/client-settings')
@UseGuards(JwtAuthGuard)
export class ClientSettingsController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  async getSettings(@RequestUser() user: JwtPayload) {
    return this.platformService.getSettings(user.client_id!);
  }

  @Put()
  async updateSettings(@RequestUser() user: JwtPayload, @Body() dto: any) {
    return this.platformService.updateSettings(user.client_id!, dto);
  }
}
