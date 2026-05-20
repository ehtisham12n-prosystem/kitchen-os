import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './entities/customer.entity';
import { CustomerLoyaltyLedger } from './entities/customer-loyalty-ledger.entity';
import { Order } from '../pos/entities/order.entity';
import { Branch } from '../setup/entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerLoyaltyLedger, Order, Branch])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule { }
