"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoClient = exports.prisma = void 0;
exports.getDb = getDb;
exports.setupDatabase = setupDatabase;
const client_1 = require("../generated/client");
const mongodb_1 = require("mongodb");
dotenv_1.default.config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('mongodb+srv')) {
    try {
        dns_1.default.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    }
    catch (e) {
        console.warn('Could not set custom DNS servers:', e);
    }
}
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
exports.mongoClient = new mongodb_1.MongoClient(process.env.DATABASE_URL);
let isConnected = false;
function getDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isConnected) {
            try {
                yield exports.mongoClient.connect();
                isConnected = true;
            }
            catch (e) {
                console.error("MongoDB Connection Error:", e);
                throw e;
            }
        }
        return exports.mongoClient.db();
    });
}
function setupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield exports.prisma.$runCommandRaw({ create: "Ledger" });
            console.log("Ledger collection ready");
        }
        catch (e) {
            if (e.code !== 48) {
                console.log("Setup note:", e.message);
            }
        }
        try {
            yield exports.prisma.$runCommandRaw({
                createIndexes: "Ledger",
                indexes: [{ key: { ledgerCode: 1 }, name: "ledgerCode_1", unique: true }]
            });
            console.log("Ledger indexes ready");
        }
        catch (e) {
            console.log("Index setup note:", e.message);
        }
        // Ensure Product collection and indexes for fast barcode scanning
        try {
            const db = yield getDb();
            yield db.collection('Product').createIndex({ barcode: 1 });
            yield db.collection('Product').createIndex({ itemCode: 1 });
            // Automatically sanitize and reset any negative stock products to 0
            yield db.collection('Product').updateMany({ stock: { $lt: 0 } }, { $set: { stock: 0 } });
            try {
                yield exports.prisma.product.updateMany({
                    where: { stock: { lt: 0 } },
                    data: { stock: 0 }
                });
            }
            catch (pe) {
                console.warn("Prisma stock cleanup note:", pe);
            }
            console.log("Product database setup & stock non-negative sanitization ready");
            // Seed sample product 100002 if missing
            const existing = yield db.collection('Product').findOne({
                $or: [{ barcode: '100002' }, { itemCode: 'ITM-100002' }]
            });
            if (!existing) {
                yield db.collection('Product').insertOne({
                    itemCode: 'ITM-100002',
                    name: "Men's Shirt",
                    barcode: '100002',
                    size: 'L',
                    department: 'Mens',
                    variety: 'Formal',
                    uom: 'PCS',
                    purchaseRate: 450,
                    price: 799,
                    mrp: 799,
                    taxPercent: 5,
                    stock: 50,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                console.log("Seeded default barcode product 100002 (Men's Shirt, Size: L, Price: 799)");
            }
        }
        catch (e) {
            console.log("Product database setup note:", e.message);
        }
    });
}
