const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product.deleteMany().then(() => {
  console.log('Products wiped');
  process.exit(0);
}).catch(console.error);
