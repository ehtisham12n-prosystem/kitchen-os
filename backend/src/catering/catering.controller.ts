import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { getAccessibleBranchIds, requireClientId } from '../auth/request-context.util';
import { CateringService } from './catering.service';
import {
  CateringEventQueryDto,
  CateringInquiryQueryDto,
  CateringOptionsQueryDto,
  CateringQuotationQueryDto,
  ConvertQuotationToEventDto,
  CreateCateringInquiryDto,
  CreateCateringQuotationDto,
  CreateEventProcurementDto,
  CreateEventProductionDto,
  IssueEventBillingDto,
  RecordEventSettlementDto,
  UpdateCateringEventDto,
  UpdateCateringEventStatusDto,
  UpdateCateringInquiryDto,
  UpdateCateringQuotationDto,
  UpdateQuotationStatusDto,
} from './dto/catering.dto';

@Controller('v1/catering')
@UseGuards(JwtAuthGuard)
@RequireFeature('crm', 'catering and event management')
export class CateringController {
  constructor(private readonly cateringService: CateringService) {}

  @Get('dashboard')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getDashboard(@RequestUser() user: JwtPayload) {
    return this.cateringService.getDashboard(requireClientId(user), getAccessibleBranchIds(user));
  }

  @Get('options')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getOptions(@RequestUser() user: JwtPayload, @Query() query: CateringOptionsQueryDto) {
    return this.cateringService.getOptions(requireClientId(user), query);
  }

  @Post('inquiries')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  createInquiry(@RequestUser() user: JwtPayload, @Body() body: CreateCateringInquiryDto) {
    return this.cateringService.createInquiry(requireClientId(user), body, user);
  }

  @Get('inquiries')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getInquiries(@RequestUser() user: JwtPayload, @Query() query: CateringInquiryQueryDto) {
    return this.cateringService.getInquiries(requireClientId(user), getAccessibleBranchIds(user), query);
  }

  @Patch('inquiries/:id')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  updateInquiry(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCateringInquiryDto,
  ) {
    return this.cateringService.updateInquiry(requireClientId(user), id, body, user);
  }

  @Post('quotations')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  createQuotation(@RequestUser() user: JwtPayload, @Body() body: CreateCateringQuotationDto) {
    return this.cateringService.createQuotation(requireClientId(user), body, user);
  }

  @Get('quotations')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getQuotations(@RequestUser() user: JwtPayload, @Query() query: CateringQuotationQueryDto) {
    return this.cateringService.getQuotations(requireClientId(user), getAccessibleBranchIds(user), query);
  }

  @Get('quotations/:id')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getQuotation(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.cateringService.getQuotation(requireClientId(user), id, getAccessibleBranchIds(user));
  }

  @Patch('quotations/:id')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  updateQuotation(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCateringQuotationDto,
  ) {
    return this.cateringService.updateQuotation(requireClientId(user), id, body, user);
  }

  @Post('quotations/:id/status')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  updateQuotationStatus(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateQuotationStatusDto,
  ) {
    return this.cateringService.updateQuotationStatus(requireClientId(user), id, body, user);
  }

  @Post('quotations/:id/convert')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  convertQuotation(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConvertQuotationToEventDto,
  ) {
    return this.cateringService.convertQuotationToEvent(requireClientId(user), id, body, user);
  }

  @Get('events')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getEvents(@RequestUser() user: JwtPayload, @Query() query: CateringEventQueryDto) {
    return this.cateringService.getEvents(requireClientId(user), getAccessibleBranchIds(user), query);
  }

  @Get('events/:id')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CATERING, APP_PERMISSIONS.CRM.CATERING_MANAGE)
  getEvent(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.cateringService.getEvent(requireClientId(user), id, getAccessibleBranchIds(user));
  }

  @Patch('events/:id')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  updateEvent(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCateringEventDto,
  ) {
    return this.cateringService.updateEvent(requireClientId(user), id, body, user);
  }

  @Post('events/:id/status')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  updateEventStatus(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCateringEventStatusDto,
  ) {
    return this.cateringService.updateEventStatus(requireClientId(user), id, body, user);
  }

  @Post('events/:id/procurement')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE, APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE)
  createProcurement(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEventProcurementDto,
  ) {
    return this.cateringService.createProcurementRequestFromEvent(requireClientId(user), id, body, user);
  }

  @Post('events/:id/production')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE)
  createProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEventProductionDto,
  ) {
    return this.cateringService.createProductionOrdersFromEvent(requireClientId(user), id, body, user);
  }

  @Post('events/:id/issue-billing')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
  issueBilling(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.cateringService.issueBilling(requireClientId(user), id, user);
  }

  @Post('events/:id/billings')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
  issueEventBilling(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: IssueEventBillingDto,
  ) {
    return this.cateringService.issueEventBilling(requireClientId(user), id, body, user);
  }

  @Post('events/:id/settlements')
  @RequirePermissions(APP_PERMISSIONS.CRM.CATERING_MANAGE, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE)
  recordSettlement(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RecordEventSettlementDto,
  ) {
    return this.cateringService.recordSettlement(requireClientId(user), id, body, user);
  }
}
