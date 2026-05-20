import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderType } from './entities/order-type.entity';
import { OrderTypeService } from './order-type.service';
import { OrderTypeController } from './order-type.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrderType])],
  controllers: [OrderTypeController],
  providers: [OrderTypeService],
  exports: [OrderTypeService],
})
export class OrderTypeModule { }
