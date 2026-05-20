import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { CreateInitialAdminDto, UpdateOnboardingStepDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('onboarding')
  listQueue() {
    return this.onboardingService.listQueue();
  }

  @Get('clients/:id/onboarding')
  getClientOnboarding(@Param('id') id: string) {
    return this.onboardingService.getClientOnboarding(id);
  }

  @Get('clients/:id/onboarding/timeline')
  getTimeline(@Param('id') id: string) {
    return this.onboardingService.getTimeline(id);
  }

  @Post('clients/:id/onboarding/start')
  startOnboarding(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    return this.onboardingService.startOnboarding(id, user);
  }

  @Patch('clients/:id/onboarding/steps/:stepKey')
  updateStep(
    @Param('id') id: string,
    @Param('stepKey') stepKey: string,
    @Body() dto: UpdateOnboardingStepDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.onboardingService.updateManualStep(id, stepKey, dto, user);
  }

  @Post('clients/:id/onboarding/steps/:stepKey/retry')
  retryStep(
    @Param('id') id: string,
    @Param('stepKey') stepKey: string,
    @RequestUser() user: JwtPayload,
  ) {
    return this.onboardingService.retryStep(id, stepKey, user);
  }

  @Post('clients/:id/onboarding/create-initial-admin')
  createInitialAdmin(
    @Param('id') id: string,
    @Body() dto: CreateInitialAdminDto,
    @RequestUser() user: JwtPayload,
  ) {
    return this.onboardingService.createInitialAdmin(id, dto, user);
  }

  @Post('clients/:id/onboarding/activate')
  activateClient(@Param('id') id: string, @RequestUser() user: JwtPayload) {
    return this.onboardingService.activateClient(id, user);
  }
}
