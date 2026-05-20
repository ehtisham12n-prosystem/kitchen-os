import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('v1/health/live')
  getLiveness() {
    return this.appService.getLiveness();
  }

  @Public()
  @Get('v1/health/ready')
  getReadiness() {
    return this.appService.getReadiness();
  }
}
