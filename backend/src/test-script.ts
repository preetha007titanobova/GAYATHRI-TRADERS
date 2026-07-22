import dotenv from 'dotenv';
import { setupDatabase } from './config/db';
import { prisma } from './config/db';

dotenv.config();

async function run() {
  await setupDatabase();
  console.log("Database connected. Fetching salesItems...");
  const startOfDay = new Date("2026-07-22T00:00:00.000");
  
  const salesItems = await prisma.salesItem.findMany({
    where: {
      salesBill: {
        invDate: { gte: startOfDay }
      }
    },
    include: {
      salesBill: true
    }
  });

  console.log("salesItems count:", salesItems.length);
  if (salesItems.length > 0) {
    console.log("First salesItem structure:", JSON.stringify(salesItems[0], null, 2));
  } else {
    console.log("No salesItems found.");
  }
  process.exit(0);
}

run().catch(console.error);
