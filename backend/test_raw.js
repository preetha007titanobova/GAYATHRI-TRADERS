const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const p = await prisma.$runCommandRaw({
      insert: 'Product',
      documents: [{ name: 'Raw Test', price: 10, stock: 0 }]
    });
    console.log('success', p);
  } catch(e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
