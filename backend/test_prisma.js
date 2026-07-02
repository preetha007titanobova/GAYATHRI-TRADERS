const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const lastProduct = await prisma.product.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { itemCode: { not: null } }
    });
    console.log("Last Product:", lastProduct);

    let nextNum = 1001;
    if (lastProduct && lastProduct.itemCode?.startsWith('ITM-')) {
      const parts = lastProduct.itemCode.split('-');
      nextNum = parseInt(parts[1] || '1000') + 1;
    }
    
    console.log("Next Code:", `ITM-${nextNum}`);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
