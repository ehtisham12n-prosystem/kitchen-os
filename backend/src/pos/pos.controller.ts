import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  getAccessibleBranchIds,
  getOptionalBranchId,
  requireActiveBranchMatch,
  requireBranchId,
  requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  AddOrderItemsDto,
  CloseOrderDto,
  CloseShiftDto,
  CreditSaleOrderDto,
  CreatePosCardMachineDto,
  CreatePosOrderDto,
  CreatePosTableDto,
  ListPosOrdersDto,
  ListPosDeviceSyncEventsDto,
  LineItemOverrideDto,
  PosSyncBatchDto,
  ReconcilePosSyncEventDto,
  ReturnOrderDto,
  SettleCreditOrderDto,
  OpenShiftDto,
  RegisterPosDeviceDto,
  CancelPosOrderDto,
  UpdatePosOrderItemDto,
  UpdateOrderItemStatusDto,
  UpdateOrderStatusDto,
  UpdateOrderTableDto,
  UpdatePosCardMachineDto,
  UpdateKotStatusDto,
  UpdatePosTableStatusDto,
  StartBusinessDayDto,
  SubmitBlindCountDto,
  ReconcileTillDto,
  UpdatePosOrderHeaderDto,
  CreateBusinessDayDto,
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
  StartOperatingShiftDto,
  UpdateOperatingShiftDto,
  AssignCounterSessionDto,
  VerifyCounterOpeningDto,
  VerifyCounterClosingDto,
  CloseBusinessDayDto,
} from './dto/pos-write.dto';
import { PosService } from './pos.service';

@Controller('v1/pos')
@UseGuards(JwtAuthGuard)
@RequireFeature('pos', 'POS operations')
export class PosController {
  constructor(private readonly posService: PosService) {}

  private async resolveOrderBranchId(user: JwtPayload, orderId: number): Promise<number> {
    const explicitBranchId = getOptionalBranchId(user);
    if (explicitBranchId) {
      return explicitBranchId;
    }

    return requireBranchId(
      user,
      await this.posService.resolveOrderBranchId(requireClientId(user), Number(orderId)),
    );
  }

  private async resolveOrderItemBranchId(user: JwtPayload, itemId: number, explicitBranchId?: number | string | null): Promise<number> {
    const activeBranchId = getOptionalBranchId(user, explicitBranchId);
    if (activeBranchId) {
      return activeBranchId;
    }

    return requireBranchId(
      user,
      await this.posService.resolveOrderItemBranchId(requireClientId(user), Number(itemId)),
    );
  }

  @Post('branches/:branchId/shifts/open')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async openShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: OpenShiftDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.openShift(clientId, activeBranchId, actorId, body.opening_float, user);
  }

  @Get('branches/:branchId/shifts/current')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getCurrentShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getCurrentShift(requireClientId(user), activeBranchId);
  }

  @Post('branches/:branchId/shifts/:shiftId/close')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async closeShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('shiftId') shiftId: number,
    @Body() body: CloseShiftDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.closeShift(clientId, activeBranchId, shiftId, body, user);
  }

  @Get('branches/:branchId/shifts')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getShifts(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getShifts(requireClientId(user), activeBranchId);
  }

  @Get('shifts/:id/analytics')
  @RequirePermissions(APP_PERMISSIONS.POS.REPORTS)
  async getShiftAnalytics(
    @RequestUser() user: JwtPayload,
    @Param('id') shiftId: number,
  ) {
    const branchId = requireBranchId(user);
    return this.posService.getShiftAnalytics(requireClientId(user), branchId, shiftId);
  }

  @Post('branches/:branchId/day/start')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async startBusinessDay(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: StartBusinessDayDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.startBusinessDay(clientId, activeBranchId, actorId, body, user);
  }

  @Get('branches/:branchId/operations/console')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async getOperationsConsole(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getOperationsConsole(requireClientId(user), activeBranchId);
  }

  @Get('branches/:branchId/order-takers')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getOrderTakers(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getPosOrderTakers(requireClientId(user), activeBranchId, user);
  }

  @Post('branches/:branchId/business-days/open')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async openBusinessDay(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreateBusinessDayDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.openBusinessDay(clientId, activeBranchId, actorId, body, user);
  }

  @Post('branches/:branchId/business-days/off-day')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async markOffDay(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreateBusinessDayDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.markOffDay(clientId, activeBranchId, actorId, body, user);
  }

  @Post('branches/:branchId/business-days/:businessDayId/close')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async closeBusinessDay(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('businessDayId') businessDayId: number,
    @Body() body: CloseBusinessDayDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.closeBusinessDay(clientId, activeBranchId, businessDayId, body, user);
  }

  @Get('branches/:branchId/business-days/:businessDayId/z-report')
  @RequirePermissions(APP_PERMISSIONS.POS.DAY_MANAGE)
  async getBusinessDayZReport(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('businessDayId') businessDayId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getBusinessDayZReport(clientId, activeBranchId, businessDayId, user);
  }

  @Get('branches/:branchId/shift-templates')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async getShiftTemplates(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getShiftTemplates(requireClientId(user), activeBranchId);
  }

  @Post('branches/:branchId/shift-templates')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async createShiftTemplate(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreateShiftTemplateDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.createShiftTemplate(clientId, activeBranchId, body, user);
  }

  @Patch('branches/:branchId/shift-templates/:templateId')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async updateShiftTemplate(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('templateId') templateId: number,
    @Body() body: UpdateShiftTemplateDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.updateShiftTemplate(clientId, activeBranchId, templateId, body, user);
  }

  @Post('branches/:branchId/shifts/start')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async startOperatingShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: StartOperatingShiftDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.startOperatingShift(clientId, activeBranchId, actorId, body, user);
  }

  @Patch('branches/:branchId/shifts/:shiftId')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async updateOperatingShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('shiftId') shiftId: number,
    @Body() body: UpdateOperatingShiftDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.updateOperatingShift(clientId, activeBranchId, shiftId, body, user);
  }

  @Post('branches/:branchId/shifts/:shiftId/end')
  @RequirePermissions(APP_PERMISSIONS.POS.SHIFT_MANAGE)
  async endOperatingShift(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('shiftId') shiftId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.endOperatingShift(clientId, activeBranchId, shiftId, user);
  }

  @Post('branches/:branchId/shifts/:shiftId/counter-sessions')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async assignCounterSession(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('shiftId') shiftId: number,
    @Body() body: AssignCounterSessionDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.assignCounterSession(clientId, activeBranchId, shiftId, body, user);
  }

  @Patch('branches/:branchId/counter-sessions/:sessionId/reassign')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async reassignCounterSession(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
    @Body() body: AssignCounterSessionDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.reassignCounterSession(clientId, activeBranchId, sessionId, body, user);
  }

  @Delete('branches/:branchId/counter-sessions/:sessionId')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async unassignCounterSession(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.unassignCounterSession(clientId, activeBranchId, sessionId, user);
  }

  @Get('branches/:branchId/counter-sessions/mine')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async getMyCounterSession(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.getMyCounterSession(clientId, activeBranchId, actorId);
  }

  @Get('branches/:branchId/counter-sessions/mine/all')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async getMyCounterSessions(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.getMyCounterSessions(clientId, activeBranchId, actorId);
  }

  @Get('branches/:branchId/counter-sessions/history')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getBranchCounterSessionHistory(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query('limit') limit?: string,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getBranchCounterSessionHistory(
      clientId,
      activeBranchId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('branches/:branchId/counter-sessions/:sessionId/x-report')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getCounterSessionXReport(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getCounterSessionXReport(clientId, activeBranchId, sessionId);
  }

  @Post('branches/:branchId/counter-sessions/:sessionId/verify-open')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async verifyCounterOpening(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
    @Body() body: VerifyCounterOpeningDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.verifyCounterOpening(clientId, activeBranchId, sessionId, actorId, body);
  }

  @Post('branches/:branchId/counter-sessions/:sessionId/blind-close')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async blindCloseCounterSession(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
    @Body() body: SubmitBlindCountDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.blindCloseCounterSession(clientId, activeBranchId, sessionId, actorId, body);
  }

  @Post('branches/:branchId/counter-sessions/:sessionId/verify-close')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async verifyCounterClosing(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('sessionId') sessionId: number,
    @Body() body: VerifyCounterClosingDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.verifyCounterClosing(clientId, activeBranchId, sessionId, body, user);
  }

  @Get('branches/:branchId/day/authorized-tills')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getAuthorizedTills(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getAuthorizedTills(requireClientId(user), activeBranchId);
  }

  @Post('branches/:branchId/day/tills/:tillId/blind-count')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async submitBlindCount(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('tillId') tillId: number,
    @Body() body: SubmitBlindCountDto,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const actorId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.submitCounterBlindCount(requireClientId(user), activeBranchId, tillId, actorId, body);
  }

  @Post('branches/:branchId/day/tills/:tillId/reconcile')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async reconcileTill(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('tillId') tillId: number,
    @Body() body: ReconcileTillDto,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.managerReconcileTill(requireClientId(user), activeBranchId, tillId, body, user);
  }

  @Patch('branches/:branchId/day/tills/:tillId/reassign')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async reassignTill(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('tillId') tillId: number,
    @Body() body: import('./dto/pos-write.dto').ReassignTillDto,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.reassignTill(requireClientId(user), activeBranchId, tillId, body);
  }

  @Post('branches/:branchId/day/tills/authorize')
  @RequirePermissions(APP_PERMISSIONS.POS.TILL_MANAGE)
  async authorizeTill(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: import('./dto/pos-write.dto').AuthorizedTillInputDto,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.authorizeTill(requireClientId(user), activeBranchId, body);
  }

  @Post('branches/:branchId/day/tills/:tillId/activate')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async activateTill(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('tillId') tillId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const userId = typeof user.sub === 'string' ? parseInt(user.sub) : user.sub;
    return this.posService.activateCounterTill(requireClientId(user), activeBranchId, tillId, userId);
  }

  @Get('branches/:branchId/counters/:counterId/history')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getCounterHistory(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('counterId') counterId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getCounterHistory(requireClientId(user), activeBranchId, counterId);
  }

  @Post('branches/:branchId/tables')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async createTable(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreatePosTableDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.createTable(clientId, activeBranchId, body);
  }

  @Get('branches/:branchId/tables')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async getBranchTables(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getBranchTables(clientId, activeBranchId);
  }

  @Put('branches/:branchId/tables/:tableId/status')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async updateTableStatus(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('tableId') tableId: number,
    @Body() body: UpdatePosTableStatusDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.updateTableStatus(
      clientId,
      activeBranchId,
      tableId,
      body.status,
    );
  }

  @Post('branches/:branchId/orders')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async createOrder(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreatePosOrderDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.createOrder(
      clientId,
      activeBranchId,
      typeof user.sub === 'string' ? parseInt(user.sub) : user.sub,
      body,
    );
  }

  @Patch('orders/:id/header')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateOrderHeader(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
    @Body() body: UpdatePosOrderHeaderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.updateOrderHeader(clientId, branchId, orderId, body);
  }

  @Get('branches/:branchId/orders')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async listOrders(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query() query: ListPosOrdersDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.listOrders(clientId, activeBranchId, query.status);
  }

  @Get('branches/:branchId/products')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async listSaleProducts(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.listSaleProducts(clientId, activeBranchId);
  }

  @Get('orders/:id')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getOrder(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.getOrder(requireClientId(user), branchId, orderId);
  }

  @Get('orders/:id/receipt')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getOrderReceipt(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.getOrderReceipt(requireClientId(user), branchId, orderId);
  }

  @Get('user-history/users')
  @RequireAnyPermissions(
    APP_PERMISSIONS.POS.USER_HISTORY_VIEW,
    APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS,
    APP_PERMISSIONS.POS.USER_HISTORY_AUDIT,
    APP_PERMISSIONS.POS.USER_HISTORY_EXPORT,
    APP_PERMISSIONS.ADMIN.AUDIT_READ,
  )
  async listUserHistoryUsers(
    @RequestUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ) {
    return this.posService.listUserHistoryUsers(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('user-history')
  @RequireAnyPermissions(
    APP_PERMISSIONS.POS.USER_HISTORY_VIEW,
    APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS,
    APP_PERMISSIONS.POS.USER_HISTORY_AUDIT,
    APP_PERMISSIONS.POS.USER_HISTORY_EXPORT,
    APP_PERMISSIONS.ADMIN.AUDIT_READ,
  )
  async getUserActivityTransactionHistory(
    @RequestUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ) {
    return this.posService.getUserActivityTransactionHistory(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('bill-void/orders')
  @RequireAnyPermissions(
    APP_PERMISSIONS.POS.BILL_VOID_VIEW,
    APP_PERMISSIONS.POS.BILL_VOID_CREATE,
    APP_PERMISSIONS.POS.BILL_VOID_APPROVE,
    APP_PERMISSIONS.POS.BILL_VOID_MANAGE,
  )
  async searchBillVoidOrders(
    @RequestUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ) {
    return this.posService.searchBillVoidOrders(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get('bill-void/report')
  @RequireAnyPermissions(
    APP_PERMISSIONS.POS.BILL_VOID_VIEW,
    APP_PERMISSIONS.POS.BILL_VOID_EXPORT,
    APP_PERMISSIONS.POS.BILL_VOID_MANAGE,
  )
  async getBillVoidReport(
    @RequestUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ) {
    return this.posService.getBillVoidReport(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Post('bill-void/orders/:orderId/void')
  @RequireAnyPermissions(
    APP_PERMISSIONS.POS.BILL_VOID_CREATE,
    APP_PERMISSIONS.POS.BILL_VOID_APPROVE,
    APP_PERMISSIONS.POS.BILL_VOID_MANAGE,
  )
  async voidBillFromManagement(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Body() body: Record<string, any>,
  ) {
    return this.posService.voidBillFromManagement(
      requireClientId(user),
      getAccessibleBranchIds(user),
      Number(orderId),
      body,
      user,
    );
  }

  @Get('branches/:branchId/reports/sales')
  @RequirePermissions(APP_PERMISSIONS.POS.REPORTS)
  async getSalesSummary(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getSalesSummary(requireClientId(user), activeBranchId, dateFrom, dateTo);
  }

  @Get('branches/:branchId/reports/top-items')
  @RequirePermissions(APP_PERMISSIONS.POS.REPORTS)
  async getTopItems(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query('limit') limit?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    const parsedLimit = Number(limit);
    return this.posService.getTopItems(
      requireClientId(user),
      activeBranchId,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
      dateFrom,
      dateTo,
    );
  }

  @Get('branches/:branchId/dashboard')
  @RequirePermissions(APP_PERMISSIONS.POS.REPORTS)
  async getBranchDaySummary(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getBranchDaySummary(requireClientId(user), activeBranchId);
  }

  @Get('branches/:branchId/kots')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getKots(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getKots(requireClientId(user), activeBranchId);
  }

  @Put('branches/:branchId/kots/:kotId/status')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateKotStatus(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('kotId') kotId: string,
    @Body() body: UpdateKotStatusDto,
  ) {
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.updateKotStatus(requireClientId(user), activeBranchId, kotId, body.status);
  }

  @Post('orders/:orderId/items')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async addItemsToOrder(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Body() body: AddOrderItemsDto,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.addItemsToOrder(
      requireClientId(user),
      branchId,
      orderId,
      body.items,
    );
  }

  @Patch('orders/:orderId/items/:itemId')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateOrderItem(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Param('itemId') itemId: number,
    @Body() body: UpdatePosOrderItemDto,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.updateOrderItem(
      requireClientId(user),
      branchId,
      orderId,
      itemId,
      body,
    );
  }

  @Delete('orders/:orderId/items/:itemId')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async removeOrderItem(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Param('itemId') itemId: number,
    @Body() body: LineItemOverrideDto,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.removeOrderItem(
      requireClientId(user),
      branchId,
      orderId,
      itemId,
      body,
    );
  }

  @Put('orders/:orderId/status')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateOrderStatus(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Body() body: UpdateOrderStatusDto,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.updateOrderStatus(
      requireClientId(user),
      branchId,
      orderId,
      body.order_status,
    );
  }

  @Post('orders/:orderId/submit-kot')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async submitOrderToKitchen(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.submitOrderToKitchen(
      requireClientId(user),
      branchId,
      orderId,
    );
  }

  @Post('orders/:orderId/cancel')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CANCEL)
  async cancelOrder(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Body() body: CancelPosOrderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.cancelOrder(
      clientId,
      branchId,
      orderId,
      {
        approval_username: body.approval_username,
        approval_pin: body.approval_pin,
        cancel_reason: body.cancel_reason,
      },
      user,
    );
  }

  @Put('orders/:orderId/table')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async reassignOrderTable(
    @RequestUser() user: JwtPayload,
    @Param('orderId') orderId: number,
    @Body() body: UpdateOrderTableDto,
  ) {
    const branchId = await this.resolveOrderBranchId(user, orderId);
    return this.posService.reassignOrderTable(
      requireClientId(user),
      branchId,
      orderId,
      body.table_id,
    );
  }

  @Put('order-items/:itemId/status')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateOrderItemStatus(
    @RequestUser() user: JwtPayload,
    @Param('itemId') itemId: number,
    @Body() body: UpdateOrderItemStatusDto & LineItemOverrideDto,
  ) {
    const branchId = await this.resolveOrderItemBranchId(user, itemId, body.branch_id);
    return this.posService.updateOrderItemStatus(
      requireClientId(user),
      branchId,
      itemId,
      body.item_status,
      body,
    );
  }

  @Post('sync')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async syncLegacy(
    @RequestUser() user: JwtPayload,
    @Body() body: any,
  ) {
    const branchId = requireActiveBranchMatch(user, body?.branch_id);
    return this.posService.handleSync(
      requireClientId(user),
      branchId,
      typeof user.sub === 'string' ? parseInt(user.sub) : user.sub,
      body,
    );
  }

  @Post('sync/batch')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async sync(
    @RequestUser() user: JwtPayload,
    @Body() body: PosSyncBatchDto,
  ) {
    const branchId = requireActiveBranchMatch(user, body.branch_id);
    return this.posService.handleSyncBatch(
      requireClientId(user),
      branchId,
      typeof user.sub === 'string' ? parseInt(user.sub) : user.sub,
      body,
      user,
    );
  }

  @Post('devices/register')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async registerDevice(
    @RequestUser() user: JwtPayload,
    @Body() body: RegisterPosDeviceDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireActiveBranchMatch(user, body.branch_id);
    return this.posService.registerDevice(clientId, branchId, body);
  }

  @Get('branches/:branchId/card-machines')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async listCardMachines(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.listCardMachines(clientId, activeBranchId);
  }

  @Post('branches/:branchId/card-machines')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async createCardMachine(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: CreatePosCardMachineDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.createCardMachine(clientId, activeBranchId, body, user);
  }

  @Patch('branches/:branchId/card-machines/:machineId')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async updateCardMachine(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('machineId') machineId: number,
    @Body() body: UpdatePosCardMachineDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.updateCardMachine(clientId, activeBranchId, machineId, body, user);
  }

  @Get('branches/:branchId/devices')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async listDevices(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.listDevices(clientId, activeBranchId);
  }

  @Get('branches/:branchId/devices/:deviceId/sync-events')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async listDeviceSyncEvents(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('deviceId') deviceId: number,
    @Query() query: ListPosDeviceSyncEventsDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.listDeviceSyncEvents(
      clientId,
      activeBranchId,
      deviceId,
      query,
    );
  }

  @Get('branches/:branchId/offline/reconciliation')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_READ)
  async getOfflineReconciliation(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.getOfflineReconciliation(clientId, activeBranchId);
  }

  @Post('branches/:branchId/devices/:deviceId/sync-events/:syncEventId/reconcile')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async reconcileSyncEvent(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('deviceId') deviceId: number,
    @Param('syncEventId') syncEventId: number,
    @Body() body: ReconcilePosSyncEventDto,
  ) {
    const clientId = requireClientId(user);
    const activeBranchId = requireActiveBranchMatch(user, branchId);
    return this.posService.reconcileSyncEvent(
      clientId,
      activeBranchId,
      deviceId,
      syncEventId,
      body,
      user,
    );
  }

  @Post('orders/:id/close')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async closeOrder(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
    @Body() body: CloseOrderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.closeOrder(
      clientId,
      branchId,
      orderId,
      {
        voucher_code: body.voucher_code,
        customer_id: body.customer_id,
        payment_mode: body.payment_mode,
        reference_number: body.reference_number,
        payments: body.payments,
        discount_amount: body.discount_amount,
        service_charge_amount: body.service_charge_amount,
        tax_amount: body.tax_amount,
        skip_tax: body.skip_tax,
        tax_code: body.tax_code,
        payment_note: body.payment_note,
        order_taker_user_id: body.order_taker_user_id,
        delivery_details: body.delivery_details,
      },
      user,
    );
  }

  @Post('orders/complete')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async completeOrder(
    @RequestUser() user: JwtPayload,
    @Body() body: CloseOrderDto & { order_id?: number },
  ) {
    const orderId = Number(body.order_id);
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.closeOrder(
      clientId,
      branchId,
      orderId,
      {
        voucher_code: body.voucher_code,
        customer_id: body.customer_id,
        payment_mode: body.payment_mode,
        reference_number: body.reference_number,
        payments: body.payments,
        discount_amount: body.discount_amount,
        service_charge_amount: body.service_charge_amount,
        tax_amount: body.tax_amount,
        skip_tax: body.skip_tax,
        tax_code: body.tax_code,
        payment_note: body.payment_note,
        order_taker_user_id: body.order_taker_user_id,
        delivery_details: body.delivery_details,
      },
      user,
    );
  }

  @Post('orders/:id/credit-sale')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async creditSaleOrder(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
    @Body() body: CreditSaleOrderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.creditSaleOrder(
      clientId,
      branchId,
      orderId,
      {
        voucher_code: body.voucher_code,
        customer_id: body.customer_id,
        order_taker_user_id: body.order_taker_user_id,
        discount_amount: body.discount_amount,
        service_charge_amount: body.service_charge_amount,
        tax_amount: body.tax_amount,
        skip_tax: body.skip_tax,
        tax_code: body.tax_code,
        payment_note: body.payment_note,
        delivery_details: body.delivery_details,
      },
      user,
    );
  }

  @Post('orders/:id/settle-credit')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_CREATE)
  async settleCreditOrder(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
    @Body() body: SettleCreditOrderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.settleCreditOrder(
      clientId,
      branchId,
      orderId,
      {
        customer_id: body.customer_id,
        payment_mode: body.payment_mode,
        reference_number: body.reference_number,
        payments: body.payments,
        payment_note: body.payment_note,
      },
      user,
    );
  }

  @Post('orders/:id/return')
  @RequirePermissions(APP_PERMISSIONS.POS.ORDER_RETURN)
  async returnOrder(
    @RequestUser() user: JwtPayload,
    @Param('id') orderId: number,
    @Body() body: ReturnOrderDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.posService.returnOrder(
      clientId,
      branchId,
      orderId,
      {
        payment_mode: body.payment_mode,
        reference_number: body.reference_number,
        payments: body.payments,
        items: body.items,
        return_note: body.return_note,
        payment_note: body.payment_note,
        restock_inventory: body.restock_inventory,
        approval_username: body.approval_username,
        approval_pin: body.approval_pin,
      },
      user,
    );
  }
}
