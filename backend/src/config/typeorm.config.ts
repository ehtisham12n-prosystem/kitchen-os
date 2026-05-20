import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getDatabaseConfig } from './database.config';

const databaseConfig = getDatabaseConfig();

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  autoLoadEntities: true,
};
