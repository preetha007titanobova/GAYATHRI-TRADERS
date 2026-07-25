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
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const db_2 = require("./config/db");
dotenv_1.default.config();
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, db_1.setupDatabase)();
        console.log("Database connected. Fetching salesItems...");
        const startOfDay = new Date("2026-07-22T00:00:00.000");
        const salesItems = yield db_2.prisma.salesItem.findMany({
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
        }
        else {
            console.log("No salesItems found.");
        }
        process.exit(0);
    });
}
run().catch(console.error);
