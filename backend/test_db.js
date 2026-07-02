const { MongoClient } = require('mongodb');

async function test() {
  const url = "mongodb+srv://rajkumar25032007_db_user:67VJm06aiBeaDa6D@billinssoftware.trrj54f.mongodb.net/ERP_DB?retryWrites=true&w=majority&appName=BILLINSSOFTWARE";
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    
    console.log("Indexes on Product:");
    const indexes = await db.collection('Product').indexes();
    console.log(indexes);

    console.log("\nProducts:");
    const products = await db.collection('Product').find().toArray();
    console.log(products);

  } catch(e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

test();
