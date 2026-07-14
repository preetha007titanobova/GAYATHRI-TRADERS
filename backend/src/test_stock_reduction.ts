import { createSalesBill, updateSalesBill, deleteSalesBill } from './services/sales.service';
import { prisma } from './config/db';

async function testStock() {
  try {
    // 1. Create a dummy product for testing
    const testProduct = await prisma.product.create({
      data: {
        itemCode: "TEST-ITEM-123",
        name: "Test Stock Product",
        barcode: "BARCODE-TEST-123",
        price: 100,
        stock: 50
      }
    });
    console.log("Created test product:", testProduct);

    // 2. Create a sales bill containing 5 qty of this product
    const billData = {
      invoiceNo: "INV-TEST-0001",
      invDate: new Date(),
      buyerName: "Test Buyer",
      totalQty: 5,
      totalAmount: 500,
      cgst: 0,
      sgst: 0,
      roundOff: 0,
      netAmount: 500,
      items: [
        {
          itemName: "Test Stock Product",
          itemDesc: "TEST-ITEM-123",
          qty: 5,
          rate: 100,
          amount: 500
        }
      ]
    };

    console.log("Creating sales bill...");
    const billResult = await createSalesBill(billData);
    console.log("Created bill result:", billResult);

    // 3. Verify stock is reduced
    let productAfterCreate = await prisma.product.findUnique({ where: { id: testProduct.id } });
    console.log("Stock after bill creation (expected 45):", productAfterCreate?.stock);

    // 4. Update sales bill to 8 qty
    console.log("Updating sales bill quantity to 8...");
    const updateData = {
      ...billData,
      totalQty: 8,
      totalAmount: 800,
      netAmount: 800,
      items: [
        {
          itemName: "Test Stock Product",
          itemDesc: "TEST-ITEM-123",
          qty: 8,
          rate: 100,
          amount: 800
        }
      ]
    };
    await updateSalesBill(billResult.id, updateData);

    // 5. Verify stock is updated
    let productAfterUpdate = await prisma.product.findUnique({ where: { id: testProduct.id } });
    console.log("Stock after bill update (expected 42):", productAfterUpdate?.stock);

    // 6. Delete sales bill
    console.log("Deleting sales bill...");
    await deleteSalesBill(billResult.id);

    // 7. Verify stock is reverted
    let productAfterDelete = await prisma.product.findUnique({ where: { id: testProduct.id } });
    console.log("Stock after bill deletion (expected 50):", productAfterDelete?.stock);

    // 8. Clean up test product
    await prisma.product.delete({ where: { id: testProduct.id } });
    console.log("Cleaned up test product.");

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testStock();
