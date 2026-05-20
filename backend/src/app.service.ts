import { Injectable } from '@nestjs/common';
import { OperationalReliabilityService } from './platform/reliability/operational-reliability.service';

@Injectable()
export class AppService {
  constructor(
    private readonly operationalReliabilityService: OperationalReliabilityService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  getLiveness() {
    return this.operationalReliabilityService.getLiveness();
  }

  getReadiness() {
    return this.operationalReliabilityService.getReadiness();
  }
}
