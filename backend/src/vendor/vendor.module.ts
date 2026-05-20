import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from './entities/vendor.entity';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Vendor])],
    controllers: [VendorController],
    providers: [VendorService],
    exports: [VendorService],
})
export class VendorModule { }
