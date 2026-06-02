import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  migrate: {
    url: process.env.DATABASE_URL!,
  },
  datasource: {
    adapter: () =>
      new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  },
});
