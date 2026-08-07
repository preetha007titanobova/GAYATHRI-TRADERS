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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockRegisterReport = exports.getDailyStockStatus = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getNextProductCode = exports.searchItems = exports.getProductByBarcode = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const getProductByBarcode = (barcode) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const db = yield (0, db_1.getDb)();
        let product = yield db.collection('Product').findOne({
            $or: [{ barcode: barcode }, { itemCode: barcode }, { vendorItemCode: barcode }]
        });
        if (!product) {
            try {
                product = yield db_1.prisma.product.findFirst({
                    where: {
                        OR: [{ barcode: barcode }, { itemCode: barcode }, { vendorItemCode: barcode }]
                    }
                });
            }
            catch (e) {
                console.error("Prisma barcode search error:", e);
            }
        }
        if (product) {
            const pItems = yield db.collection('PurchaseItem').find({
                $or: [{ itemCode: product.itemCode }, { barcode: barcode }]
            }).toArray();
            if (pItems && pItems.length > 0) {
                const totalInward = pItems.reduce((sum, i) => sum + ((Number(i.qty) || 0) + (Number(i.freeQty) || 0)), 0);
                let totalOutward = 0;
                try {
                    const sItems = yield db_1.prisma.salesItem.findMany({
                        where: { OR: [{ productId: product.id || ((_a = product._id) === null || _a === void 0 ? void 0 : _a.toString()) }, { itemCode: product.itemCode }] }
                    });
                    totalOutward = sItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
                }
                catch (se) { }
                product.stock = Math.max(0, totalInward - totalOutward);
            }
            else {
                product.stock = Math.max(0, Number(product.stock) || 0);
            }
        }
        return product;
    }
    catch (err) {
        console.error("Error in getProductByBarcode:", err);
        return null;
    }
});
exports.getProductByBarcode = getProductByBarcode;
const searchItems = (q) => __awaiter(void 0, void 0, void 0, function* () {
    let mongoItems = [];
    try {
        const db = yield (0, db_1.getDb)();
        if (!q) {
            mongoItems = yield db.collection('Product').find({}).limit(100).toArray();
        }
        else {
            const regex = new RegExp(q, 'i');
            mongoItems = yield db.collection('Product').find({
                $or: [
                    { name: regex },
                    { itemCode: regex },
                    { barcode: regex },
                    { variety: regex },
                    { department: regex },
                    { size: regex },
                    { vendorItemCode: regex }
                ]
            }).limit(100).toArray();
        }
    }
    catch (e) {
        console.error("MongoDB product search error:", e);
    }
    let prismaItems = [];
    try {
        prismaItems = yield db_1.prisma.product.findMany({
            where: q ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { itemCode: { contains: q, mode: 'insensitive' } },
                    { barcode: { contains: q, mode: 'insensitive' } },
                    { variety: { contains: q, mode: 'insensitive' } },
                    { department: { contains: q, mode: 'insensitive' } },
                    { size: { contains: q, mode: 'insensitive' } },
                    { vendorItemCode: { contains: q, mode: 'insensitive' } }
                ]
            } : undefined,
            take: 100
        });
    }
    catch (e) {
        console.error("Prisma product search error:", e);
    }
    // Fetch purchase and sales totals to calculate accurate stock based on Purchase Register
    const inwardMap = new Map();
    const outwardMap = new Map();
    try {
        const db = yield (0, db_1.getDb)();
        const purchaseItems = yield db.collection('PurchaseItem').find({}).toArray();
        for (const item of purchaseItems) {
            const codeKey = (item.itemCode || '').toUpperCase().trim();
            const qty = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
            if (codeKey) {
                inwardMap.set(codeKey, (inwardMap.get(codeKey) || 0) + qty);
            }
        }
        const salesItems = yield db_1.prisma.salesItem.findMany({});
        for (const item of salesItems) {
            const prodKey = (item.productId || '').toUpperCase().trim();
            const qty = Number(item.qty) || 0;
            if (prodKey) {
                outwardMap.set(prodKey, (outwardMap.get(prodKey) || 0) + qty);
            }
        }
    }
    catch (e) {
        console.error("Error fetching purchase/sales totals for searchItems stock calculation:", e);
    }
    // Fetch defective sales returns to get damage reasons
    const returnReasonsMap = new Map();
    try {
        const returnItems = yield db_1.prisma.salesReturnItem.findMany({
            where: {
                disposition: { in: ['Defective / Damaged', 'Quarantine & Scrap'] }
            },
            include: {
                salesReturn: true
            }
        });
        for (const item of returnItems) {
            if (item.productId && item.salesReturn) {
                const prodId = item.productId.toString();
                const reasonText = `${item.salesReturn.reason || 'No Reason'} (${item.returnQty} pcs from Return ${item.salesReturn.returnNo})`;
                if (!returnReasonsMap.has(prodId)) {
                    returnReasonsMap.set(prodId, []);
                }
                returnReasonsMap.get(prodId).push(reasonText);
            }
        }
    }
    catch (e) {
        console.error("Error fetching sales return damage reasons:", e);
    }
    const map = new Map();
    [...mongoItems, ...prismaItems].forEach((item) => {
        var _a, _b, _c;
        const codeKey = (item.itemCode || item.barcode || ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || item.id || '').toUpperCase().trim();
        if (codeKey) {
            if (!map.has(codeKey)) {
                const id = ((_b = item._id) === null || _b === void 0 ? void 0 : _b.toString()) || item.id;
                const totalInward = (_c = inwardMap.get(codeKey)) !== null && _c !== void 0 ? _c : (id ? inwardMap.get(id.toUpperCase()) : undefined);
                const totalOutward = outwardMap.get(codeKey) || (id ? outwardMap.get(id.toUpperCase()) || 0 : 0);
                // Compute stock from Purchase Register if purchase items exist
                let calculatedStock = Math.max(0, Number(item.stock) || 0);
                if (totalInward !== undefined) {
                    calculatedStock = Math.max(0, totalInward - totalOutward);
                }
                map.set(codeKey, Object.assign(Object.assign({}, item), { id, _id: id, barcode: item.barcode || '', itemCode: item.itemCode || '', size: item.size || '', price: Number(item.price) || 0, stock: calculatedStock, damageReasons: returnReasonsMap.get(id) || [] }));
            }
        }
    });
    return Array.from(map.values());
});
exports.searchItems = searchItems;
const getNextProductCode = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let nextNum = 1001;
    try {
        const db = yield (0, db_1.getDb)();
        const lastMongoProduct = yield db.collection('Product')
            .find({ itemCode: { $regex: '^ITM-' } })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();
        if (lastMongoProduct && lastMongoProduct.length > 0) {
            const parts = (lastMongoProduct[0].itemCode || '').split('-');
            const num = parseInt(parts[1] || '1000', 10);
            if (!isNaN(num))
                nextNum = num + 1;
        }
        else {
            const lastProduct = yield db_1.prisma.product.findFirst({
                orderBy: { createdAt: 'desc' },
                where: { itemCode: { not: null } }
            });
            if (lastProduct && ((_a = lastProduct.itemCode) === null || _a === void 0 ? void 0 : _a.startsWith('ITM-'))) {
                const parts = lastProduct.itemCode.split('-');
                const num = parseInt(parts[1] || '1000', 10);
                if (!isNaN(num))
                    nextNum = num + 1;
            }
        }
    }
    catch (e) {
        console.error("Error in getNextProductCode:", e);
    }
    return `ITM-${nextNum}`;
});
exports.getNextProductCode = getNextProductCode;
const createProduct = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    return yield db.collection('Product').insertOne(Object.assign(Object.assign({}, data), { purchaseRate: Number(data.purchaseRate) || 0, price: Number(data.price) || 0, mrp: Number(data.mrp) || 0, taxPercent: Number(data.taxPercent) || 0, stock: Math.max(0, Math.round(Number(data.stock) || 0)), createdAt: new Date(), updatedAt: new Date() }));
});
exports.createProduct = createProduct;
const updateProduct = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const { id: _, _id, createdAt, updatedAt } = data, updatableFields = __rest(data, ["id", "_id", "createdAt", "updatedAt"]);
    const result = yield db.collection('Product').updateOne({ _id: new mongodb_1.ObjectId(id) }, {
        $set: Object.assign(Object.assign({}, updatableFields), { purchaseRate: Number(data.purchaseRate) || 0, price: Number(data.price) || 0, mrp: Number(data.mrp) || 0, taxPercent: Number(data.taxPercent) || 0, stock: Math.max(0, Math.round(Number(data.stock) || 0)), updatedAt: new Date() })
    });
    return result.matchedCount > 0;
});
exports.updateProduct = updateProduct;
const deleteProduct = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let objId;
    try {
        objId = new mongodb_1.ObjectId(id);
    }
    catch (e) {
        objId = id;
    }
    const result = yield db.collection('Product').deleteOne({
        $or: [{ _id: objId }, { _id: id }, { itemCode: id }]
    });
    return result.deletedCount > 0;
});
exports.deleteProduct = deleteProduct;
const getDailyStockStatus = (dateStr) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const startOfDay = new Date(`${dateStr}T00:00:00.000`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999`);
    const products = yield (0, exports.searchItems)('');
    let salesItems = [];
    try {
        salesItems = yield db_1.prisma.salesItem.findMany({
            where: {
                salesBill: {
                    invDate: { gte: startOfDay }
                }
            },
            include: {
                salesBill: true
            }
        });
    }
    catch (e) {
        console.error("Error fetching salesItems:", e);
    }
    let salesReturnItems = [];
    try {
        salesReturnItems = yield db_1.prisma.salesReturnItem.findMany({
            where: {
                disposition: 'Return to Warehouse',
                salesReturn: {
                    returnDate: { gte: startOfDay }
                }
            },
            include: {
                salesReturn: true
            }
        });
    }
    catch (e) {
        console.error("Error fetching salesReturnItems:", e);
    }
    let purchaseItems = [];
    try {
        const db = yield (0, db_1.getDb)();
        const purchaseBills = yield db.collection('PurchaseBill').find({
            date: { $gte: startOfDay }
        }).toArray();
        const purchaseBillMap = new Map(purchaseBills.map(b => [b._id.toString(), b]));
        purchaseItems = yield db.collection('PurchaseItem').find({
            purchaseBillId: { $in: purchaseBills.map(b => b._id) }
        }).toArray();
        for (const item of purchaseItems) {
            item.purchaseBill = purchaseBillMap.get((_a = item.purchaseBillId) === null || _a === void 0 ? void 0 : _a.toString()) || null;
        }
    }
    catch (e) {
        console.error("Error fetching purchaseItems:", e);
    }
    let shopSalesItems = [];
    try {
        const db = yield (0, db_1.getDb)();
        const shopSalesBills = yield db.collection('ShopSalesBill').find({
            date: { $gte: startOfDay }
        }).toArray();
        const shopSalesBillMap = new Map(shopSalesBills.map(b => [b._id.toString(), b]));
        shopSalesItems = yield db.collection('ShopSalesItem').find({
            shopSalesBillId: { $in: shopSalesBills.map(b => b._id) }
        }).toArray();
        for (const item of shopSalesItems) {
            item.shopSalesBill = shopSalesBillMap.get((_b = item.shopSalesBillId) === null || _b === void 0 ? void 0 : _b.toString()) || null;
        }
    }
    catch (e) {
        console.error("Error fetching shopSalesItems:", e);
    }
    return products.map(product => {
        const prodId = product.id || product._id;
        const productSales = salesItems.filter(item => item.productId === prodId);
        const productReturns = salesReturnItems.filter(item => item.productId === prodId);
        const productPurchases = purchaseItems.filter(item => { var _a; return ((_a = item.productId) === null || _a === void 0 ? void 0 : _a.toString()) === prodId || (item.itemCode === product.itemCode); });
        const productShopSales = shopSalesItems.filter(item => { var _a; return ((_a = item.productId) === null || _a === void 0 ? void 0 : _a.toString()) === prodId || (item.itemCode === product.itemCode); });
        let outwardToday = 0;
        let inwardToday = 0;
        let outwardAfterToday = 0;
        let inwardAfterToday = 0;
        let purchasesToday = 0;
        let returnsToday = 0;
        for (const item of productSales) {
            if (item.salesBill) {
                const invDate = new Date(item.salesBill.invDate);
                if (invDate >= startOfDay && invDate <= endOfDay) {
                    outwardToday += item.qty || 0;
                }
                else if (invDate > endOfDay) {
                    outwardAfterToday += item.qty || 0;
                }
            }
        }
        for (const item of productShopSales) {
            if (item.shopSalesBill) {
                const saleDate = new Date(item.shopSalesBill.date);
                if (saleDate >= startOfDay && saleDate <= endOfDay) {
                    outwardToday += item.qty || 0;
                }
                else if (saleDate > endOfDay) {
                    outwardAfterToday += item.qty || 0;
                }
            }
        }
        for (const item of productReturns) {
            if (item.salesReturn) {
                const returnDate = new Date(item.salesReturn.returnDate);
                if (returnDate >= startOfDay && returnDate <= endOfDay) {
                    inwardToday += item.returnQty || 0;
                    returnsToday += item.returnQty || 0;
                }
                else if (returnDate > endOfDay) {
                    inwardAfterToday += item.returnQty || 0;
                }
            }
        }
        for (const item of productPurchases) {
            if (item.purchaseBill) {
                const purchaseDate = new Date(item.purchaseBill.date);
                if (purchaseDate >= startOfDay && purchaseDate <= endOfDay) {
                    inwardToday += item.qty || 0;
                    purchasesToday += item.qty || 0;
                }
                else if (purchaseDate > endOfDay) {
                    inwardAfterToday += item.qty || 0;
                }
            }
        }
        const currentStock = Number(product.stock) || 0;
        const closingStock = currentStock - inwardAfterToday + outwardAfterToday;
        const openingStock = closingStock - inwardToday + outwardToday;
        // Determine unique payment modes for today's transactions
        const soldModes = [];
        productSales.forEach(item => {
            if (item.salesBill) {
                const invDate = new Date(item.salesBill.invDate);
                if (invDate >= startOfDay && invDate <= endOfDay && item.salesBill.paymentMode) {
                    if (!soldModes.includes(item.salesBill.paymentMode)) {
                        soldModes.push(item.salesBill.paymentMode);
                    }
                }
            }
        });
        productShopSales.forEach(item => {
            if (item.shopSalesBill) {
                const saleDate = new Date(item.shopSalesBill.date);
                if (saleDate >= startOfDay && saleDate <= endOfDay && item.shopSalesBill.paymentMode) {
                    if (!soldModes.includes(item.shopSalesBill.paymentMode)) {
                        soldModes.push(item.shopSalesBill.paymentMode);
                    }
                }
            }
        });
        const purchasedModes = [];
        productPurchases.forEach(item => {
            if (item.purchaseBill) {
                const purchaseDate = new Date(item.purchaseBill.date);
                if (purchaseDate >= startOfDay && purchaseDate <= endOfDay && item.purchaseBill.paymentMode) {
                    if (!purchasedModes.includes(item.purchaseBill.paymentMode)) {
                        purchasedModes.push(item.purchaseBill.paymentMode);
                    }
                }
            }
        });
        const returnedModes = [];
        productReturns.forEach(item => {
            if (item.salesReturn) {
                const returnDate = new Date(item.salesReturn.returnDate);
                if (returnDate >= startOfDay && returnDate <= endOfDay && item.salesReturn.paymentMode) {
                    if (!returnedModes.includes(item.salesReturn.paymentMode)) {
                        returnedModes.push(item.salesReturn.paymentMode);
                    }
                }
            }
        });
        const mapPaymentMode = (mode) => {
            const m = mode.toLowerCase();
            if (m.includes('upi') || m.includes('online'))
                return 'Online Pay';
            if (m.includes('card') || m.includes('bank'))
                return 'Card Pay';
            if (m.includes('credit') || m.includes('ledger'))
                return 'Credit Pay';
            if (m.includes('cash'))
                return 'Cash Pay';
            return mode;
        };
        const allModes = [];
        soldModes.forEach(m => {
            const mapped = mapPaymentMode(m);
            if (!allModes.includes(mapped))
                allModes.push(mapped);
        });
        purchasedModes.forEach(m => {
            const mapped = `${mapPaymentMode(m)} (Pur)`;
            if (!allModes.includes(mapped))
                allModes.push(mapped);
        });
        returnedModes.forEach(m => {
            const mapped = `${mapPaymentMode(m)} (Ret)`;
            if (!allModes.includes(mapped))
                allModes.push(mapped);
        });
        const paymentMode = allModes.join(', ') || '-';
        let status = 'In Stock';
        if (closingStock <= 0) {
            status = 'Out of Stock';
        }
        else if (closingStock < 10) {
            status = 'Low Stock';
        }
        return {
            id: prodId,
            itemCode: product.itemCode || '',
            name: product.name,
            barcode: product.barcode || '',
            category: product.department || '',
            size: product.size || '',
            uom: product.uom || 'PCS',
            purchaseRate: Number(product.purchaseRate) || 0,
            price: Number(product.price) || 0,
            openingStock,
            inwardToday: purchasesToday, // only purchases today
            returnsToday, // returns today
            outwardToday, // sold today
            closingStock,
            pendingOrderQty: 0,
            valuation: closingStock * (Number(product.purchaseRate) || 0),
            status,
            paymentMode
        };
    });
});
exports.getDailyStockStatus = getDailyStockStatus;
const getStockRegisterReport = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const products = yield (0, exports.searchItems)('');
    let salesItems = [];
    try {
        salesItems = yield db_1.prisma.salesItem.findMany({
            include: { salesBill: true }
        });
    }
    catch (e) {
        console.error("Error in getStockRegisterReport salesItems:", e);
    }
    let salesReturns = [];
    let salesReturnItems = [];
    try {
        const db = yield (0, db_1.getDb)();
        salesReturns = yield db.collection('SalesReturn').find({}).toArray();
        salesReturnItems = yield db_1.prisma.salesReturnItem.findMany({
            where: { disposition: 'Return to Warehouse' }
        });
        const salesReturnMap = new Map(salesReturns.map(r => [r._id.toString() || r.id, r]));
        for (const item of salesReturnItems) {
            item.salesReturn = salesReturnMap.get((_a = item.salesReturnId) === null || _a === void 0 ? void 0 : _a.toString()) || null;
        }
    }
    catch (e) {
        console.error("Error in getStockRegisterReport salesReturnItems:", e);
    }
    let purchaseItems = [];
    try {
        const db = yield (0, db_1.getDb)();
        purchaseItems = yield db.collection('PurchaseItem').find({}).toArray();
        const purchaseBills = yield db.collection('PurchaseBill').find({}).toArray();
        const purchaseBillMap = new Map(purchaseBills.map(b => [b._id.toString(), b]));
        for (const item of purchaseItems) {
            item.purchaseBill = purchaseBillMap.get((_b = item.purchaseBillId) === null || _b === void 0 ? void 0 : _b.toString()) || null;
        }
    }
    catch (e) {
        console.error("Error in getStockRegisterReport purchaseItems:", e);
    }
    return products.map(product => {
        var _a;
        const prodId = product.id || product._id;
        const prodSales = salesItems.filter(item => item.productId === prodId);
        const prodReturns = salesReturnItems.filter(item => item.productId === prodId);
        const prodPurchases = purchaseItems.filter(item => { var _a; return ((_a = item.productId) === null || _a === void 0 ? void 0 : _a.toString()) === prodId || (item.itemCode === product.itemCode); });
        const dbMovements = [];
        for (const item of prodSales) {
            if (item.salesBill) {
                dbMovements.push({
                    id: item.id,
                    date: item.salesBill.invDate,
                    vchType: 'Sales',
                    vchNo: item.salesBill.invoiceNo,
                    particulars: item.salesBill.buyerName,
                    inward: 0,
                    outward: item.qty
                });
            }
        }
        for (const item of prodReturns) {
            if (item.salesReturn) {
                dbMovements.push({
                    id: item.id,
                    date: item.salesReturn.returnDate,
                    vchType: 'Sales Return',
                    vchNo: item.salesReturn.returnNo,
                    particulars: `Returned by customer: ${item.salesReturn.customerName}`,
                    inward: item.returnQty,
                    outward: 0,
                    reason: item.salesReturn.reason
                });
            }
        }
        for (const ret of salesReturns) {
            if (ret.returnType === 'Exchange (Replacement)' && ret.replacementItems && Array.isArray(ret.replacementItems)) {
                ret.replacementItems.forEach((repItem) => {
                    var _a, _b;
                    const isMatch = (product.itemCode && repItem.itemCode === product.itemCode) ||
                        (product.name && ((_a = repItem.itemName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === product.name.toLowerCase());
                    if (isMatch) {
                        dbMovements.push({
                            id: `${((_b = ret._id) === null || _b === void 0 ? void 0 : _b.toString()) || ret.id}-rep-${repItem.itemCode || repItem.itemName}`,
                            date: ret.returnDate,
                            vchType: 'Sales Return Exchange',
                            vchNo: ret.returnNo,
                            particulars: `Replacement item to: ${ret.customerName}`,
                            inward: 0,
                            outward: Number(repItem.qty) || 0
                        });
                    }
                });
            }
        }
        for (const item of prodPurchases) {
            if (item.purchaseBill) {
                dbMovements.push({
                    id: ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || item.id,
                    date: item.purchaseBill.date,
                    vchType: 'Purchase',
                    vchNo: item.purchaseBill.voucherNo,
                    particulars: item.purchaseBill.supplierName,
                    inward: (Number(item.qty) || 0) + (Number(item.freeQty) || 0),
                    outward: 0
                });
            }
        }
        dbMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const totalInward = dbMovements.reduce((sum, m) => sum + m.inward, 0);
        const totalOutward = dbMovements.reduce((sum, m) => sum + m.outward, 0);
        const calculatedOpeningBalance = (Number(product.stock) || 0) - totalInward + totalOutward;
        return {
            id: prodId,
            itemCode: product.itemCode || '',
            vendorItemCode: product.vendorItemCode || '',
            name: product.name,
            department: product.department || '',
            variety: product.variety || '',
            size: product.size || '',
            uom: product.uom || 'PCS',
            purchaseRate: Number(product.purchaseRate) || 0,
            price: Number(product.price) || 0,
            dbStock: Number(product.stock) || 0,
            openingBalance: calculatedOpeningBalance,
            pendingOrderQty: 0,
            movements: dbMovements
        };
    });
});
exports.getStockRegisterReport = getStockRegisterReport;
