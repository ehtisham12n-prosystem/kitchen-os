import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CatalogService } from './catalog/catalog.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Branch } from './setup/entities/branch.entity';
import { Product } from './catalog/entities/product.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const catalogService = app.get(CatalogService);
  
  const branchRepo = app.get(getRepositoryToken(Branch));
  const orderRepo = app.get(getRepositoryToken(require('./pos/entities/order.entity').Order));
  
  const recentOrders = await orderRepo.find({ order: { created_at: 'DESC' }, limit: 5 });
  console.log('--- RECENT ORDERS ---');
  recentOrders.forEach(o => console.log(`Order ID: ${o.id}, Branch ID: ${o.branch_id}, Client ID: ${o.client_id}, Status: ${o.order_status}`));

  const branches = await branchRepo.find();
  
  if (branches.length === 0) {
      console.error('No branches found in DB');
      return await app.close();
  }

  const clientId = branches[0].client_id;
  const branchId = branches[0].id;

  console.log(`Using Client: ${clientId}, Branch: ${branchId} (${branches[0].branch_name})`);
  
  console.log('--- PRODUCT STATUS DUMP ---');
  try {
    const products = await catalogService.getProductsWithBranchStatus(clientId, branchId);
    console.log(`Total products: ${products.length}`);
    
    for (const p of products.slice(0, 10)) {
        console.log(`Product: ${p.product_name} (ID: ${p.id})`);
        console.log(`  is_active: ${p.is_active}`);
        console.log(`  is_branch_active: ${p.is_branch_active}`);
        console.log(`  distribution_scope: ${p.distribution_scope}`);
        console.log(`  effective_enabled: ${p.effective_enabled}`);
        console.log(`  unavailable_reason: ${p.unavailable_reason}`);
        console.log(`  channel_availability: ${JSON.stringify(p.channel_availability)}`);
        console.log('---');
    }

    const beefPulao = products.find(p => p.product_name.toLowerCase().includes('beef pulao'));
    if (beefPulao) {
        console.log('--- BEEF PULAO DETAIL ---');
        console.log(JSON.stringify(beefPulao, null, 2));
        
        for (const channel of ['dine_in', 'takeout', 'delivery', null]) {
            console.log(`--- FETCHING CONTEXT FOR CHANNEL: ${channel} ---`);
            const context = await catalogService.getBranchProductSaleContext(clientId, branchId, beefPulao.id, channel as any);
            console.log(`Effective Enabled: ${context.effective_enabled}, Reason: ${context.unavailable_reason}`);
        }
    }

  } catch (error) {
    console.error('Error during dump:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
