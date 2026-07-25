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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteShopSalesBill = exports.updateShopSalesBill = exports.searchShopSalesBills = exports.createShopSalesBill = exports.getNextShopSalesVoucher = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const getNextShopSalesVoucher = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const lastBill = yield db.collection('ShopSalesBill')
        .find({})
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    let nextNum = 1001;
    if (lastBill && lastBill.voucherNo && lastBill.voucherNo.startsWith('SSB-')) {
        const parts = lastBill.voucherNo.split('-');
        const parsed = parseInt(parts[1] || '1000');
        if (!isNaN(parsed)) {
            nextNum = parsed + 1;
        }
    }
    return `SSB-${nextNum}`;
});
exports.getNextShopSalesVoucher = getNextShopSalesVoucher;
const createShopSalesBill = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const purchaseBillId = new mongodb_1.ObjectId();
    const voucherNo = data.voucherNo || (yield (0, exports.getNextShopSalesVoucher)());
    // 1. Create the ShopSalesBill document
    const { date, shopName, shopGstin, taxableAmt, cgst, sgst, igst, otherCharges, netPayable, status, type, paymentMode, items } = data;
    yield db.collection('ShopSalesBill').insertOne({
        _id: purchaseBillId,
        voucherNo,
        date: date ? new Date(date) : new Date(),
        shopName,
        shopGstin: shopGstin || '',
        taxableAmt: Number(taxableAmt) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        igst: Number(igst) || 0,
        otherCharges: Number(otherCharges) || 0,
        netPayable: Number(netPayable) || 0,
        status: status || 'Paid',
        type: type || 'Local',
        paymentMode: paymentMode || 'Cash',
        createdAt: new Date(),
        updatedAt: new Date()
    });
    // 2. Process each item (DECREMENT stock since we are selling to another shop)
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            const qty = Number(item.qty || item.purchasedQty) || 0;
            const rate = Number(item.rate || item.unitPrice) || 0;
            const taxPercent = Number(item.taxPercent) || 0;
            const discPercent = Number(item.discPercent) || 0;
            const total = Number(item.total) || 0;
            // Check if product exists in DB by itemCode
            let product = null;
            if (item.itemCode) {
                product = yield db_1.prisma.product.findFirst({
                    where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
                });
            }
            let productId = null;
            if (product) {
                productId = new mongodb_1.ObjectId(product.id);
                // Product exists: decrement stock (sold/transferred out)
                yield db_1.prisma.product.update({
                    where: { id: product.id },
                    data: {
                        stock: {
                            decrement: Math.round(qty)
                        },
                        purchaseRate: rate,
                        price: item.salesRate ? Number(item.salesRate) : product.price,
                        mrp: item.mrp ? Number(item.mrp) : product.mrp,
                        size: item.size || product.size,
                        variety: item.variety || product.variety,
                        department: item.category || item.department || product.department,
                        factory: item.factory || product.factory,
                        vendorItemCode: item.vendorItemCode || product.vendorItemCode,
                    }
                });
            }
            else {
                // Product does not exist: create a new one with negative stock
                const newProduct = yield db_1.prisma.product.create({
                    data: {
                        itemCode: item.itemCode,
                        name: item.itemName || item.itemDesc || item.itemCode,
                        barcode: item.itemCode,
                        uom: 'Piece',
                        purchaseRate: rate,
                        price: Number(item.salesRate || rate),
                        mrp: Number(item.mrp || rate),
                        taxPercent: taxPercent,
                        stock: -Math.round(qty),
                        department: item.category || item.department || 'None',
                        variety: item.variety || '',
                        size: item.size || '',
                        factory: item.factory || '',
                        vendorItemCode: item.vendorItemCode || ''
                    }
                });
                productId = new mongodb_1.ObjectId(newProduct.id);
            }
            itemsToInsert.push({
                shopSalesBillId: purchaseBillId,
                productId: productId,
                itemCode: item.itemCode,
                itemName: item.itemName || item.itemDesc || item.itemCode,
                size: item.size || '',
                variety: item.variety || '',
                category: item.category || item.department || 'None',
                factory: item.factory || '',
                vendorItemCode: item.vendorItemCode || '',
                qty: qty,
                rate: rate,
                taxPercent: taxPercent,
                discPercent: discPercent,
                total: total
            });
        }
        if (itemsToInsert.length > 0) {
            yield db.collection('ShopSalesItem').insertMany(itemsToInsert);
        }
    }
    return { id: purchaseBillId.toString(), voucherNo };
});
exports.createShopSalesBill = createShopSalesBill;
const searchShopSalesBills = (q) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let query = {};
    if (q) {
        const regex = new RegExp(q, 'i');
        query.$or = [
            { voucherNo: regex },
            { shopName: regex }
        ];
    }
    const bills = yield db.collection('ShopSalesBill')
        .find(query)
        .sort({ date: -1 })
        .toArray();
    const mapped = [];
    for (const bill of bills) {
        const items = yield db.collection('ShopSalesItem')
            .find({ shopSalesBillId: bill._id })
            .toArray();
        mapped.push(Object.assign(Object.assign({}, bill), { id: bill._id.toString(), items: items.map(i => (Object.assign(Object.assign({}, i), { id: i._id.toString() }))) }));
    }
    return mapped;
});
exports.searchShopSalesBills = searchShopSalesBills;
const updateShopSalesBill = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const billId = new mongodb_1.ObjectId(id);
    // 1. Revert previous stock changes (since we decremented, we must increment old qty back)
    const oldItems = yield db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
    for (const item of oldItems) {
        const qty = Number(item.qty) || 0;
        if (qty > 0 && item.productId) {
            yield db_1.prisma.product.update({
                where: { id: item.productId.toString() },
                data: {
                    stock: {
                        increment: Math.round(qty)
                    }
                }
            });
        }
    }
    // 2. Delete old items
    yield db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });
    // 3. Update the ShopSalesBill document
    const { voucherNo, date, shopName, shopGstin, taxableAmt, cgst, sgst, igst, otherCharges, netPayable, status, type, paymentMode, items } = data;
    const result = yield db.collection('ShopSalesBill').updateOne({ _id: billId }, {
        $set: {
            voucherNo,
            date: date ? new Date(date) : new Date(),
            shopName,
            shopGstin: shopGstin || '',
            taxableAmt: Number(taxableAmt) || 0,
            cgst: Number(cgst) || 0,
            sgst: Number(sgst) || 0,
            igst: Number(igst) || 0,
            otherCharges: Number(otherCharges) || 0,
            netPayable: Number(netPayable) || 0,
            status: status || 'Paid',
            type: type || 'Local',
            paymentMode: paymentMode || 'Cash',
            updatedAt: new Date()
        }
    });
    // 4. Insert new items and decrement stock
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            const qty = Number(item.qty || item.purchasedQty) || 0;
            const rate = Number(item.rate || item.unitPrice) || 0;
            const taxPercent = Number(item.taxPercent) || 0;
            const discPercent = Number(item.discPercent) || 0;
            const total = Number(item.total) || 0;
            let product = null;
            if (item.itemCode) {
                product = yield db_1.prisma.product.findFirst({
                    where: { itemCode: { equals: item.itemCode.trim(), mode: 'insensitive' } }
                });
            }
            let productId = null;
            if (product) {
                productId = new mongodb_1.ObjectId(product.id);
                yield db_1.prisma.product.update({
                    where: { id: product.id },
                    data: {
                        stock: {
                            decrement: Math.round(qty)
                        },
                        purchaseRate: rate,
                        price: item.salesRate ? Number(item.salesRate) : product.price,
                        mrp: item.mrp ? Number(item.mrp) : product.mrp,
                        size: item.size || product.size,
                        variety: item.variety || product.variety,
                        department: item.category || item.department || product.department,
                        factory: item.factory || product.factory,
                        vendorItemCode: item.vendorItemCode || product.vendorItemCode,
                    }
                });
            }
            else {
                const newProduct = yield db_1.prisma.product.create({
                    data: {
                        itemCode: item.itemCode,
                        name: item.itemName || item.itemDesc || item.itemCode,
                        barcode: item.itemCode,
                        uom: 'Piece',
                        purchaseRate: rate,
                        price: Number(item.salesRate || rate),
                        mrp: Number(item.mrp || rate),
                        taxPercent: taxPercent,
                        stock: -Math.round(qty),
                        department: item.category || item.department || 'None',
                        variety: item.variety || '',
                        size: item.size || '',
                        factory: item.factory || '',
                        vendorItemCode: item.vendorItemCode || ''
                    }
                });
                productId = new mongodb_1.ObjectId(newProduct.id);
            }
            itemsToInsert.push({
                shopSalesBillId: billId,
                productId: productId,
                itemCode: item.itemCode,
                itemName: item.itemName || item.itemDesc || item.itemCode,
                size: item.size || '',
                variety: item.variety || '',
                category: item.category || item.department || 'None',
                factory: item.factory || '',
                vendorItemCode: item.vendorItemCode || '',
                qty: qty,
                rate: rate,
                taxPercent: taxPercent,
                discPercent: discPercent,
                total: total
            });
        }
        if (itemsToInsert.length > 0) {
            yield db.collection('ShopSalesItem').insertMany(itemsToInsert);
        }
    }
    return result.matchedCount > 0;
});
exports.updateShopSalesBill = updateShopSalesBill;
const deleteShopSalesBill = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const billId = new mongodb_1.ObjectId(id);
    // Revert stock changes (since we decremented, we increment it back)
    const oldItems = yield db.collection('ShopSalesItem').find({ shopSalesBillId: billId }).toArray();
    for (const item of oldItems) {
        const qty = Number(item.qty) || 0;
        if (qty > 0 && item.productId) {
            yield db_1.prisma.product.update({
                where: { id: item.productId.toString() },
                data: {
                    stock: {
                        increment: Math.round(qty)
                    }
                }
            });
        }
    }
    // Delete items
    yield db.collection('ShopSalesItem').deleteMany({ shopSalesBillId: billId });
    // Delete bill
    const result = yield db.collection('ShopSalesBill').deleteOne({ _id: billId });
    return result.deletedCount > 0;
});
exports.deleteShopSalesBill = deleteShopSalesBill;
