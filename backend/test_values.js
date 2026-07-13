const { MongoClient } = require('mongodb');

async function test() {
  const url = "mongodb+srv://rajkumar25032007_db_user:67VJm06aiBeaDa6D@billinssoftware.trrj54f.mongodb.net/ERP_DB?retryWrites=true&w=majority&appName=BILLINSSOFTWARE";
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    
    console.log("Finding all clothing products with department, variety or size...");
    const products = await db.collection('Product').find({
      $or: [
        { department: { $ne: null } },
        { variety: { $ne: null } },
        { size: { $ne: null } }
      ]
    }).toArray();
    console.log("Count:", products.length);
    console.log("Products:", JSON.stringify(products, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

test();
