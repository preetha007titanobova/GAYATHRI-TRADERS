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
exports.cancelSalesOrder = exports.deleteSalesOrder = exports.updateSalesOrder = exports.getSalesOrderDetails = exports.searchSalesOrders = exports.createSalesOrder = exports.getNextSalesOrderSequence = exports.getReturnsByInvoice = exports.getSalesStatusReport = exports.getStockLedger = exports.deleteSalesReturn = exports.updateSalesReturn = exports.getSalesReturnDetails = exports.searchSalesReturns = exports.createSalesReturn = exports.getNextSalesReturnSequence = exports.getSalesBillByInvoiceNo = exports.searchSalesBills = exports.deleteSalesBill = exports.updateSalesBill = exports.createSalesBill = exports.getNextInvoice = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const getNextInvoice = () => __awaiter(void 0, void 0, void 0, function* () {
    const lastBill = yield db_1.prisma.salesBill.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    let nextNum = 1;
    if (lastBill && lastBill.invoiceNo.startsWith('INV-')) {
        const parts = lastBill.invoiceNo.split('-');
        const parsed = parseInt(parts[2] || '0');
        if (!isNaN(parsed)) {
            nextNum = parsed + 1;
        }
    }
    const year = new Date().getFullYear();
    return `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
});
exports.getNextInvoice = getNextInvoice;
const createSalesBill = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const { invoiceNo, invDate, payDays, buyerName, address, eType, mobileNo, gstNo, printIn, invFormat, invoiceFormat, totalQty, totalAmount, cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode, fromSalesOrderId } = data;
    const db = yield (0, db_1.getDb)();
    // Server-side Stock Validation: Ensure stock never goes negative
    if (items && items.length > 0) {
        for (const item of items) {
            const qty = Number(item.qty) || 0;
            if (qty <= 0)
                continue;
            let product = null;
            if (item.productId) {
                product = yield db_1.prisma.product.findUnique({ where: { id: item.productId } });
            }
            if (!product && item.itemDesc) {
                product = yield db_1.prisma.product.findFirst({
                    where: { OR: [{ itemCode: item.itemDesc }, { barcode: item.itemDesc }] }
                });
            }
            if (!product && item.itemName) {
                product = yield db_1.prisma.product.findFirst({ where: { name: item.itemName } });
            }
            if (product) {
                const availableStock = Number(product.stock) || 0;
                if (availableStock < qty) {
                    throw new Error(`Insufficient stock for item "${product.name}". Available: ${availableStock}, Requested: ${qty}`);
                }
            }
        }
    }
    const billResult = yield db.collection('SalesBill').insertOne({
        invoiceNo,
        invDate: new Date(invDate),
        payDays: Number(payDays) || 0,
        buyerName,
        address,
        eType,
        mobileNo,
        gstNo,
        printIn,
        invFormat: invFormat || invoiceFormat,
        totalQty: Number(totalQty) || 0,
        totalAmount: Number(totalAmount) || 0,
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        roundOff: Number(roundOff) || 0,
        netAmount: Number(netAmount) || 0,
        remarks,
        shippingAddress,
        salesman,
        paymentMode: paymentMode || 'Cash',
        isSelectiveCustomer: Boolean(data.isSelectiveCustomer),
        fromSalesOrderId: fromSalesOrderId ? new mongodb_1.ObjectId(fromSalesOrderId) : null,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            let productId = item.productId ? new mongodb_1.ObjectId(item.productId) : null;
            let product = null;
            if (productId) {
                product = yield db_1.prisma.product.findUnique({
                    where: { id: productId.toString() }
                });
            }
            if (!product && item.itemDesc) {
                product = yield db_1.prisma.product.findFirst({
                    where: {
                        OR: [
                            { itemCode: item.itemDesc },
                            { barcode: item.itemDesc }
                        ]
                    }
                });
            }
            if (!product && item.itemName) {
                product = yield db_1.prisma.product.findFirst({
                    where: { name: item.itemName }
                });
            }
            const qty = Number(item.qty) || 0;
            if (product) {
                productId = new mongodb_1.ObjectId(product.id);
                if (qty > 0) {
                    const currentStock = Number(product.stock) || 0;
                    const updatedStock = Math.max(0, currentStock - Math.round(qty));
                    yield db_1.prisma.product.update({
                        where: { id: product.id },
                        data: { stock: updatedStock }
                    });
                    yield db.collection('Product').updateOne({ _id: new mongodb_1.ObjectId(product.id) }, { $set: { stock: updatedStock } });
                }
            }
            else {
                if (qty > 0 && item.itemName) {
                    const p = yield db.collection('Product').findOne({ name: item.itemName });
                    if (p) {
                        const currentStock = Number(p.stock) || 0;
                        const updatedStock = Math.max(0, currentStock - Math.round(qty));
                        yield db.collection('Product').updateOne({ _id: p._id }, { $set: { stock: updatedStock } });
                    }
                }
            }
            // If this bill is generated from a Sales Order, update unfulfilled quantity
            if (fromSalesOrderId) {
                const orderItem = yield db_1.prisma.salesOrderItem.findFirst({
                    where: {
                        salesOrderId: fromSalesOrderId,
                        OR: [
                            { productId: productId === null || productId === void 0 ? void 0 : productId.toString() },
                            { itemCode: item.itemCode || item.itemDesc },
                            { itemName: item.itemName }
                        ]
                    }
                });
                if (orderItem) {
                    const newDelivered = Math.min(orderItem.orderedQty, orderItem.deliveredQty + qty);
                    const newPending = Math.max(0, orderItem.orderedQty - newDelivered);
                    yield db_1.prisma.salesOrderItem.update({
                        where: { id: orderItem.id },
                        data: {
                            deliveredQty: newDelivered,
                            pendingQty: newPending
                        }
                    });
                }
            }
            itemsToInsert.push({
                salesBillId: billResult.insertedId,
                itemName: item.itemName,
                itemDesc: item.itemDesc,
                size: item.size || (product === null || product === void 0 ? void 0 : product.size) || null,
                qty: qty,
                uom: item.uom,
                rate: Number(item.rate) || 0,
                discPercent: Number(item.discPercent) || 0,
                discAmt: Number(item.discAmt) || 0,
                amount: Number(item.amount) || 0,
                productId: productId
            });
        }
        yield db.collection('SalesItem').insertMany(itemsToInsert);
    }
    // Update overall Sales Order status based on all items' remaining pending quantities
    if (fromSalesOrderId) {
        const remainingItems = yield db_1.prisma.salesOrderItem.findMany({
            where: { salesOrderId: fromSalesOrderId }
        });
        const totalPending = remainingItems.reduce((sum, it) => sum + it.pendingQty, 0);
        const totalDelivered = remainingItems.reduce((sum, it) => sum + it.deliveredQty, 0);
        let newStatus = 'Open';
        if (totalPending === 0) {
            newStatus = 'Completed';
        }
        else if (totalDelivered > 0) {
            newStatus = 'Partial';
        }
        yield db.collection('SalesOrder').updateOne({ _id: new mongodb_1.ObjectId(fromSalesOrderId) }, { $set: { status: newStatus, updatedAt: new Date() } });
    }
    return { id: billResult.insertedId.toString(), invoiceNo };
});
exports.createSalesBill = createSalesBill;
const updateSalesBill = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { invoiceNo, invDate, payDays, buyerName, address, eType, mobileNo, gstNo, printIn, invFormat, invoiceFormat, totalQty, totalAmount, cgst, sgst, roundOff, netAmount, remarks, shippingAddress, items, salesman, paymentMode } = data;
    const db = yield (0, db_1.getDb)();
    const billId = new mongodb_1.ObjectId(id);
    // Revert old stock changes
    const oldItems = yield db.collection('SalesItem').find({ salesBillId: billId }).toArray();
    for (const item of oldItems) {
        const qty = Number(item.qty) || 0;
        if (qty > 0) {
            if (item.productId) {
                yield db_1.prisma.product.updateMany({
                    where: { id: item.productId.toString() },
                    data: {
                        stock: {
                            increment: Math.round(qty)
                        }
                    }
                });
            }
            else if (item.itemName) {
                yield db_1.prisma.product.updateMany({
                    where: { name: item.itemName },
                    data: {
                        stock: {
                            increment: Math.round(qty)
                        }
                    }
                });
            }
        }
    }
    const billResult = yield db.collection('SalesBill').updateOne({ _id: billId }, {
        $set: {
            invoiceNo,
            invDate: new Date(invDate),
            payDays: Number(payDays) || 0,
            buyerName,
            address,
            eType,
            mobileNo,
            gstNo,
            printIn,
            invFormat: invFormat || invoiceFormat,
            totalQty: Number(totalQty) || 0,
            totalAmount: Number(totalAmount) || 0,
            cgst: Number(cgst) || 0,
            sgst: Number(sgst) || 0,
            roundOff: Number(roundOff) || 0,
            netAmount: Number(netAmount) || 0,
            remarks,
            shippingAddress,
            salesman,
            paymentMode: paymentMode || 'Cash',
            isSelectiveCustomer: Boolean(data.isSelectiveCustomer),
            updatedAt: new Date()
        }
    });
    if (billResult.matchedCount === 0) {
        return false;
    }
    // Delete existing items
    yield db.collection('SalesItem').deleteMany({ salesBillId: billId });
    // Insert new items and reduce stock
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            let productId = item.productId ? new mongodb_1.ObjectId(item.productId) : null;
            let product = null;
            if (productId) {
                product = yield db_1.prisma.product.findUnique({
                    where: { id: productId.toString() }
                });
            }
            if (!product && item.itemDesc) {
                product = yield db_1.prisma.product.findFirst({
                    where: {
                        OR: [
                            { itemCode: item.itemDesc },
                            { barcode: item.itemDesc }
                        ]
                    }
                });
            }
            if (!product && item.itemName) {
                product = yield db_1.prisma.product.findFirst({
                    where: { name: item.itemName }
                });
            }
            const qty = Number(item.qty) || 0;
            if (product) {
                productId = new mongodb_1.ObjectId(product.id);
                if (qty > 0) {
                    yield db_1.prisma.product.updateMany({
                        where: { id: product.id },
                        data: {
                            stock: {
                                decrement: Math.round(qty)
                            }
                        }
                    });
                }
            }
            else {
                if (qty > 0 && item.itemName) {
                    yield db_1.prisma.product.updateMany({
                        where: { name: item.itemName },
                        data: {
                            stock: {
                                decrement: Math.round(qty)
                            }
                        }
                    });
                }
            }
            itemsToInsert.push({
                salesBillId: billId,
                itemName: item.itemName,
                itemDesc: item.itemDesc,
                size: item.size || (product === null || product === void 0 ? void 0 : product.size) || null,
                qty: qty,
                uom: item.uom,
                rate: Number(item.rate) || 0,
                discPercent: Number(item.discPercent) || 0,
                discAmt: Number(item.discAmt) || 0,
                amount: Number(item.amount) || 0,
                productId: productId
            });
        }
        yield db.collection('SalesItem').insertMany(itemsToInsert);
    }
    return true;
});
exports.updateSalesBill = updateSalesBill;
const deleteSalesBill = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const billId = new mongodb_1.ObjectId(id);
    // Revert stock changes first
    const oldItems = yield db.collection('SalesItem').find({ salesBillId: billId }).toArray();
    for (const item of oldItems) {
        const qty = Number(item.qty) || 0;
        if (qty > 0) {
            if (item.productId) {
                yield db_1.prisma.product.updateMany({
                    where: { id: item.productId.toString() },
                    data: {
                        stock: {
                            increment: Math.round(qty)
                        }
                    }
                });
            }
            else if (item.itemName) {
                yield db_1.prisma.product.updateMany({
                    where: { name: item.itemName },
                    data: {
                        stock: {
                            increment: Math.round(qty)
                        }
                    }
                });
            }
        }
    }
    yield db.collection('SalesItem').deleteMany({ salesBillId: billId });
    const result = yield db.collection('SalesBill').deleteOne({ _id: billId });
    return result.deletedCount > 0;
});
exports.deleteSalesBill = deleteSalesBill;
const searchSalesBills = (q) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let query = {};
    if (q) {
        const isSearchSelective = q.toLowerCase().includes('selective');
        query.$or = [
            { invoiceNo: { $regex: q, $options: 'i' } },
            { buyerName: { $regex: q, $options: 'i' } },
            { paymentMode: { $regex: q, $options: 'i' } },
            { mobileNo: { $regex: q, $options: 'i' } }
        ];
        if (isSearchSelective) {
            query.$or.push({ isSelectiveCustomer: true });
        }
    }
    let cursor = db.collection('SalesBill').find(query).sort({ createdAt: -1 });
    if (!q) {
        cursor = cursor.limit(100);
    }
    return yield cursor.toArray();
});
exports.searchSalesBills = searchSalesBills;
const getSalesBillByInvoiceNo = (invoiceNo) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const bill = yield db.collection('SalesBill').findOne({ invoiceNo });
    if (!bill)
        return null;
    const items = yield db.collection('SalesItem').find({ salesBillId: bill._id }).toArray();
    const itemsWithDetails = [];
    for (const item of items) {
        let barcode = '';
        let size = item.size || '';
        let prod = null;
        if (item.productId) {
            prod = yield db.collection('Product').findOne({ _id: new mongodb_1.ObjectId(item.productId) });
        }
        if (!prod && item.itemDesc) {
            prod = yield db.collection('Product').findOne({ itemCode: item.itemDesc });
        }
        if (!prod && item.itemName) {
            prod = yield db.collection('Product').findOne({ name: item.itemName });
        }
        if (prod) {
            barcode = prod.barcode || prod.itemCode || '';
            if (!size)
                size = prod.size || '';
        }
        itemsWithDetails.push(Object.assign(Object.assign({}, item), { barcode, size: size || '-' }));
    }
    return Object.assign(Object.assign({}, bill), { items: itemsWithDetails });
});
exports.getSalesBillByInvoiceNo = getSalesBillByInvoiceNo;
const getNextSalesReturnSequence = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const lastReturn = yield db.collection('SalesReturn').find().sort({ createdAt: -1 }).limit(1).toArray();
    let nextNum = 1;
    if (lastReturn && lastReturn.length > 0 && lastReturn[0].returnNo && lastReturn[0].returnNo.startsWith('CN-')) {
        const parts = lastReturn[0].returnNo.split('-');
        const parsed = parseInt(parts[2] || '0');
        if (!isNaN(parsed)) {
            nextNum = parsed + 1;
        }
    }
    const today = new Date();
    const month = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const fy = month >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    return `CN-${fy}-${nextNum.toString().padStart(4, '0')}`;
});
exports.getNextSalesReturnSequence = getNextSalesReturnSequence;
const createSalesReturn = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const { returnNo, returnDate, originalInvoice, customerName, reason, returnType, totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items, extraReceived, refundAmount, paymentMode, refundMethod, replacementItems } = data;
    const db = yield (0, db_1.getDb)();
    const returnResult = yield db.collection('SalesReturn').insertOne({
        returnNo,
        returnDate: new Date(returnDate),
        originalInvoice,
        customerName,
        reason,
        returnType: returnType || 'Credit Note (Refund)',
        totalReturnAmount: Number(totalReturnAmount) || 0,
        cgstReturn: Number(cgstReturn) || 0,
        sgstReturn: Number(sgstReturn) || 0,
        igstReturn: Number(igstReturn) || 0,
        roundOff: Number(roundOff) || 0,
        netRefundAmount: Number(netRefundAmount) || 0,
        extraReceived: Number(extraReceived) || 0,
        refundAmount: Number(refundAmount) || 0,
        paymentMode: paymentMode || 'Cash',
        refundMethod: refundMethod || 'Cash',
        replacementItems: replacementItems || [],
        createdAt: new Date()
    });
    if (items && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
            salesReturnId: returnResult.insertedId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            invoicedQty: Number(item.invoicedQty) || 0,
            returnQty: Number(item.returnQty) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            taxableAmt: Number(item.taxableAmt) || 0,
            taxPercent: Number(item.taxPercent) || 0,
            disposition: item.disposition,
            subtotal: Number(item.subtotal) || 0,
            productId: item.productId ? new mongodb_1.ObjectId(item.productId) : null
        }));
        yield db.collection('SalesReturnItem').insertMany(itemsToInsert);
        for (const item of itemsToInsert) {
            if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
                if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
                    // Increment damagedStock in MongoDB directly
                    yield db.collection('Product').updateOne({ $or: [{ itemCode: item.itemCode }, { name: item.itemName }] }, { $inc: { damagedStock: item.returnQty } });
                }
                else {
                    // Default or Return to Warehouse: increment normal stock
                    yield db_1.prisma.product.updateMany({
                        where: {
                            OR: [
                                { itemCode: item.itemCode },
                                { name: item.itemName }
                            ]
                        },
                        data: {
                            stock: {
                                increment: item.returnQty
                            }
                        }
                    });
                }
            }
        }
    }
    // Process replacement items stock changes if it is an Exchange
    if (returnType === 'Exchange (Replacement)' && replacementItems && replacementItems.length > 0) {
        for (const repItem of replacementItems) {
            const qty = Number(repItem.qty) || 0;
            if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: repItem.itemCode },
                            { name: repItem.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            decrement: qty
                        }
                    }
                });
            }
        }
    }
    // Adjust Ledger opening balance
    if (customerName) {
        const ledger = yield db.collection('Ledger').findOne({ accountName: customerName });
        if (ledger) {
            let ledgerAdjustment = 0;
            if (returnType === 'Exchange (Replacement)') {
                const netDiff = (Number(extraReceived) || 0) - (Number(refundAmount) || 0);
                if (netDiff > 0) {
                    if (paymentMode === 'Credit') {
                        ledgerAdjustment = netDiff;
                    }
                }
                else if (netDiff < 0) {
                    if (refundMethod === 'Store Credit') {
                        ledgerAdjustment = netDiff; // netDiff is negative, so this decrements openingBalance
                    }
                }
            }
            else {
                ledgerAdjustment = -Number(netRefundAmount);
            }
            if (ledgerAdjustment !== 0) {
                yield db.collection('Ledger').updateOne({ _id: ledger._id }, { $inc: { openingBalance: Number(ledgerAdjustment) } });
            }
        }
    }
    return { id: returnResult.insertedId.toString(), returnNo };
});
exports.createSalesReturn = createSalesReturn;
const searchSalesReturns = (q) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let query = {};
    if (q) {
        query.$or = [
            { returnNo: { $regex: q, $options: 'i' } },
            { customerName: { $regex: q, $options: 'i' } },
            { paymentMode: { $regex: q, $options: 'i' } },
            { refundMethod: { $regex: q, $options: 'i' } }
        ];
    }
    return yield db.collection('SalesReturn').find(query).sort({ createdAt: -1 }).limit(100).toArray();
});
exports.searchSalesReturns = searchSalesReturns;
const getSalesReturnDetails = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const returnId = new mongodb_1.ObjectId(id);
    const salesReturn = yield db.collection('SalesReturn').findOne({ _id: returnId });
    if (!salesReturn)
        return null;
    const items = yield db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
    return Object.assign(Object.assign({}, salesReturn), { items });
});
exports.getSalesReturnDetails = getSalesReturnDetails;
const updateSalesReturn = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { returnNo, returnDate, originalInvoice, customerName, reason, returnType, totalReturnAmount, cgstReturn, sgstReturn, igstReturn, roundOff, netRefundAmount, items, extraReceived, refundAmount, paymentMode, refundMethod, replacementItems } = data;
    const db = yield (0, db_1.getDb)();
    const returnId = new mongodb_1.ObjectId(id);
    // Revert old stock changes
    const oldItems = yield db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
    const oldReturn = yield db.collection('SalesReturn').findOne({ _id: returnId });
    for (const item of oldItems) {
        if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
            // Revert returned item stock increment
            if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
                yield db.collection('Product').updateOne({ $or: [{ itemCode: item.itemCode }, { name: item.itemName }] }, { $inc: { damagedStock: -item.returnQty } });
            }
            else {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: item.itemCode },
                            { name: item.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            decrement: item.returnQty
                        }
                    }
                });
            }
        }
    }
    // Revert old replacement item stock decrement if it was an exchange
    if (oldReturn && oldReturn.returnType === 'Exchange (Replacement)' && oldReturn.replacementItems && oldReturn.replacementItems.length > 0) {
        for (const repItem of oldReturn.replacementItems) {
            const qty = Number(repItem.qty) || 0;
            if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: repItem.itemCode },
                            { name: repItem.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            increment: qty
                        }
                    }
                });
            }
        }
    }
    // Revert old ledger impact
    if (oldReturn && oldReturn.customerName) {
        const ledger = yield db.collection('Ledger').findOne({ accountName: oldReturn.customerName });
        if (ledger) {
            let ledgerAdjustment = 0;
            if (oldReturn.returnType === 'Exchange (Replacement)') {
                const oldDiff = (Number(oldReturn.extraReceived) || 0) - (Number(oldReturn.refundAmount) || 0);
                if (oldDiff > 0) {
                    if (oldReturn.paymentMode === 'Credit') {
                        ledgerAdjustment = -oldDiff;
                    }
                }
                else if (oldDiff < 0) {
                    if (oldReturn.refundMethod === 'Store Credit') {
                        ledgerAdjustment = -oldDiff;
                    }
                }
            }
            else {
                ledgerAdjustment = Number(oldReturn.netRefundAmount) || 0;
            }
            if (ledgerAdjustment !== 0) {
                yield db.collection('Ledger').updateOne({ _id: ledger._id }, { $inc: { openingBalance: Number(ledgerAdjustment) } });
            }
        }
    }
    // Update return header
    const updateResult = yield db.collection('SalesReturn').updateOne({ _id: returnId }, {
        $set: {
            returnNo,
            returnDate: new Date(returnDate),
            originalInvoice,
            customerName,
            reason,
            returnType,
            totalReturnAmount: Number(totalReturnAmount) || 0,
            cgstReturn: Number(cgstReturn) || 0,
            sgstReturn: Number(sgstReturn) || 0,
            igstReturn: Number(igstReturn) || 0,
            roundOff: Number(roundOff) || 0,
            netRefundAmount: Number(netRefundAmount) || 0,
            extraReceived: Number(extraReceived) || 0,
            refundAmount: Number(refundAmount) || 0,
            paymentMode: paymentMode || 'Cash',
            refundMethod: refundMethod || 'Cash',
            replacementItems: replacementItems || [],
            updatedAt: new Date()
        }
    });
    if (updateResult.matchedCount === 0) {
        return false;
    }
    // Delete and Insert return items
    yield db.collection('SalesReturnItem').deleteMany({ salesReturnId: returnId });
    if (items && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
            salesReturnId: returnId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            invoicedQty: Number(item.invoicedQty) || 0,
            returnQty: Number(item.returnQty) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            taxableAmt: Number(item.taxableAmt) || 0,
            taxPercent: Number(item.taxPercent) || 0,
            disposition: item.disposition,
            subtotal: Number(item.subtotal) || 0,
            productId: item.productId ? new mongodb_1.ObjectId(item.productId) : null
        }));
        yield db.collection('SalesReturnItem').insertMany(itemsToInsert);
        // Apply new stock changes
        for (const item of itemsToInsert) {
            if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
                if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
                    yield db.collection('Product').updateOne({ $or: [{ itemCode: item.itemCode }, { name: item.itemName }] }, { $inc: { damagedStock: item.returnQty } });
                }
                else {
                    yield db_1.prisma.product.updateMany({
                        where: {
                            OR: [
                                { itemCode: item.itemCode },
                                { name: item.itemName }
                            ]
                        },
                        data: {
                            stock: {
                                increment: item.returnQty
                            }
                        }
                    });
                }
            }
        }
    }
    // Apply new replacement items stock changes if it is an Exchange
    if (returnType === 'Exchange (Replacement)' && replacementItems && replacementItems.length > 0) {
        for (const repItem of replacementItems) {
            const qty = Number(repItem.qty) || 0;
            if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: repItem.itemCode },
                            { name: repItem.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            decrement: qty
                        }
                    }
                });
            }
        }
    }
    // Apply new ledger impact
    if (customerName) {
        const ledger = yield db.collection('Ledger').findOne({ accountName: customerName });
        if (ledger) {
            let ledgerAdjustment = 0;
            if (returnType === 'Exchange (Replacement)') {
                const netDiff = (Number(extraReceived) || 0) - (Number(refundAmount) || 0);
                if (netDiff > 0) {
                    if (paymentMode === 'Credit') {
                        ledgerAdjustment = netDiff;
                    }
                }
                else if (netDiff < 0) {
                    if (refundMethod === 'Store Credit') {
                        ledgerAdjustment = netDiff;
                    }
                }
            }
            else {
                ledgerAdjustment = -Number(netRefundAmount);
            }
            if (ledgerAdjustment !== 0) {
                yield db.collection('Ledger').updateOne({ _id: ledger._id }, { $inc: { openingBalance: Number(ledgerAdjustment) } });
            }
        }
    }
    return true;
});
exports.updateSalesReturn = updateSalesReturn;
const deleteSalesReturn = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const returnId = new mongodb_1.ObjectId(id);
    const salesReturn = yield db.collection('SalesReturn').findOne({ _id: returnId });
    if (!salesReturn)
        return false;
    const items = yield db.collection('SalesReturnItem').find({ salesReturnId: returnId }).toArray();
    for (const item of items) {
        if (item.returnQty > 0 && (item.itemCode || item.itemName)) {
            // Revert returned item stock increment
            if (item.disposition === 'Defective / Damaged' || item.disposition === 'Quarantine & Scrap') {
                yield db.collection('Product').updateOne({ $or: [{ itemCode: item.itemCode }, { name: item.itemName }] }, { $inc: { damagedStock: -item.returnQty } });
            }
            else {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: item.itemCode },
                            { name: item.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            decrement: item.returnQty
                        }
                    }
                });
            }
        }
    }
    // Revert replacement item stock decrement if it was an exchange
    if (salesReturn.returnType === 'Exchange (Replacement)' && salesReturn.replacementItems && salesReturn.replacementItems.length > 0) {
        for (const repItem of salesReturn.replacementItems) {
            const qty = Number(repItem.qty) || 0;
            if (qty > 0 && (repItem.itemCode || repItem.itemName)) {
                yield db_1.prisma.product.updateMany({
                    where: {
                        OR: [
                            { itemCode: repItem.itemCode },
                            { name: repItem.itemName }
                        ]
                    },
                    data: {
                        stock: {
                            increment: qty
                        }
                    }
                });
            }
        }
    }
    // Revert ledger impact
    if (salesReturn.customerName) {
        const ledger = yield db.collection('Ledger').findOne({ accountName: salesReturn.customerName });
        if (ledger) {
            let ledgerAdjustment = 0;
            if (salesReturn.returnType === 'Exchange (Replacement)') {
                const oldDiff = (Number(salesReturn.extraReceived) || 0) - (Number(salesReturn.refundAmount) || 0);
                if (oldDiff > 0) {
                    if (salesReturn.paymentMode === 'Credit') {
                        ledgerAdjustment = -oldDiff;
                    }
                }
                else if (oldDiff < 0) {
                    if (salesReturn.refundMethod === 'Store Credit') {
                        ledgerAdjustment = -oldDiff;
                    }
                }
            }
            else {
                ledgerAdjustment = Number(salesReturn.netRefundAmount) || 0;
            }
            if (ledgerAdjustment !== 0) {
                yield db.collection('Ledger').updateOne({ _id: ledger._id }, { $inc: { openingBalance: Number(ledgerAdjustment) } });
            }
        }
    }
    yield db.collection('SalesReturnItem').deleteMany({ salesReturnId: returnId });
    const result = yield db.collection('SalesReturn').deleteOne({ _id: returnId });
    return result.deletedCount > 0;
});
exports.deleteSalesReturn = deleteSalesReturn;
const getStockLedger = (productId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const db = yield (0, db_1.getDb)();
    const product = yield db_1.prisma.product.findUnique({
        where: { id: productId }
    });
    if (!product)
        return null;
    // Outward Movements (Sales)
    const salesItems = yield db_1.prisma.salesItem.findMany({
        where: { productId },
        include: { salesBill: true }
    });
    // Inward Movements (Sales Returns)
    const returnItems = yield db_1.prisma.salesReturnItem.findMany({
        where: { productId }
    });
    const salesReturns = yield db.collection('SalesReturn').find({}).toArray();
    const salesReturnMap = new Map(salesReturns.map(r => [r._id.toString() || r.id, r]));
    for (const item of returnItems) {
        item.salesReturn = salesReturnMap.get((_a = item.salesReturnId) === null || _a === void 0 ? void 0 : _a.toString()) || null;
    }
    // Virtual Movements (Sales Orders)
    let orderItems = [];
    try {
        orderItems = (yield ((_b = db_1.prisma.salesOrderItem) === null || _b === void 0 ? void 0 : _b.findMany({
            where: {
                productId,
                salesOrder: {
                    status: { in: ['Open', 'Partial'] }
                }
            },
            include: {
                salesOrder: true
            }
        }))) || [];
    }
    catch (e) {
        console.error("Error fetching salesOrderItems in getStockLedger:", e);
    }
    let movements = [];
    for (const item of salesItems) {
        if (item.salesBill) {
            movements.push({
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
    for (const item of returnItems) {
        if (item.salesReturn) {
            movements.push({
                id: item.id,
                date: item.salesReturn.returnDate,
                vchType: 'Sales Return',
                vchNo: item.salesReturn.returnNo,
                particulars: `Returned by customer: ${item.salesReturn.customerName}`,
                inward: item.returnQty,
                outward: 0,
                disposition: item.disposition,
                reason: item.salesReturn.reason
            });
        }
    }
    // Outward replacement movements from sales returns
    for (const ret of salesReturns) {
        if (ret.returnType === 'Exchange (Replacement)' && ret.replacementItems && Array.isArray(ret.replacementItems)) {
            ret.replacementItems.forEach((repItem) => {
                var _a, _b;
                const isMatch = (product.itemCode && repItem.itemCode === product.itemCode) ||
                    (product.name && ((_a = repItem.itemName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === product.name.toLowerCase());
                if (isMatch) {
                    movements.push({
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
    for (const item of orderItems) {
        if (item.salesOrder) {
            movements.push({
                id: item.id,
                date: item.salesOrder.orderDate,
                vchType: 'Sales Order',
                vchNo: item.salesOrder.orderNumber,
                particulars: `Ordered by: ${item.salesOrder.buyerName} (Pending: ${item.pendingQty} ${product.uom || 'PCS'} in sales order)`,
                inward: 0,
                outward: 0
            });
        }
    }
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const totalInward = movements.reduce((sum, m) => sum + m.inward, 0);
    const totalOutward = movements.reduce((sum, m) => sum + m.outward, 0);
    const calculatedOpeningBalance = product.stock - totalInward + totalOutward;
    return {
        productId,
        productName: product.name,
        currentStock: product.stock,
        openingBalance: calculatedOpeningBalance,
        movements
    };
});
exports.getStockLedger = getStockLedger;
const getSalesStatusReport = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const bills = yield db.collection('SalesBill').find().sort({ createdAt: -1 }).toArray();
    const returns = yield db.collection('SalesReturn').find().toArray();
    return bills.map((bill) => {
        const billReturns = returns.filter((r) => r.originalInvoice === bill.invoiceNo);
        let totalReturned = 0;
        let totalExchanged = 0;
        let totalRefunded = 0;
        let totalExtraReceived = 0;
        billReturns.forEach((r) => {
            if (r.returnType === 'Exchange (Replacement)') {
                const returnedVal = (Number(r.totalReturnAmount) || 0) + (Number(r.cgstReturn) || 0) + (Number(r.sgstReturn) || 0) + (Number(r.igstReturn) || 0);
                totalReturned += returnedVal;
                let repVal = 0;
                if (Array.isArray(r.replacementItems)) {
                    r.replacementItems.forEach((item) => {
                        repVal += Number(item.subtotal) || 0;
                    });
                }
                totalExchanged += repVal;
                totalExtraReceived += Number(r.extraReceived) || 0;
                totalRefunded += Number(r.refundAmount) || 0;
            }
            else {
                const returnedVal = Number(r.netRefundAmount) || Number(r.totalReturnAmount) || 0;
                totalReturned += returnedVal;
                totalRefunded += returnedVal;
            }
        });
        const originalSale = bill.netAmount || 0;
        const netSale = originalSale - totalReturned + totalExchanged;
        let status = 'Completed';
        if (billReturns.length > 0) {
            const hasExchange = billReturns.some((r) => r.returnType === 'Exchange (Replacement)');
            if (hasExchange) {
                if (totalReturned >= originalSale) {
                    status = 'Fully Exchanged';
                }
                else {
                    status = 'Partially Exchanged';
                }
            }
            else {
                if (totalReturned >= originalSale) {
                    status = 'Fully Returned';
                }
                else {
                    status = 'Partially Returned';
                }
            }
        }
        return {
            id: bill._id,
            invoiceNo: bill.invoiceNo,
            invDate: bill.invDate || bill.createdAt,
            buyerName: bill.buyerName,
            originalSale,
            returned: totalReturned,
            exchanged: totalExchanged,
            refunded: totalRefunded,
            extraReceived: totalExtraReceived,
            netSale,
            status
        };
    });
});
exports.getSalesStatusReport = getSalesStatusReport;
const getReturnsByInvoice = (invoiceNo) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const returns = yield db.collection('SalesReturn').find({ originalInvoice: invoiceNo }).toArray();
    for (const r of returns) {
        r.items = yield db.collection('SalesReturnItem').find({ salesReturnId: r._id }).toArray();
    }
    return returns;
});
exports.getReturnsByInvoice = getReturnsByInvoice;
// --- Sales Order Services ---
const getNextSalesOrderSequence = () => __awaiter(void 0, void 0, void 0, function* () {
    const lastOrder = yield db_1.prisma.salesOrder.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    let nextNum = 1;
    if (lastOrder && lastOrder.orderNumber.startsWith('SO-')) {
        const parts = lastOrder.orderNumber.split('-');
        const parsed = parseInt(parts[2] || '0');
        if (!isNaN(parsed)) {
            nextNum = parsed + 1;
        }
    }
    const year = new Date().getFullYear();
    return `SO-${year}-${nextNum.toString().padStart(4, '0')}`;
});
exports.getNextSalesOrderSequence = getNextSalesOrderSequence;
const createSalesOrder = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderNo, orderDate, customer, deliveryDate, status, isInterstate, summary, items, mobileNo, address, remarks, salesman, advancePaid, paymentMode } = data;
    const db = yield (0, db_1.getDb)();
    const orderNumber = orderNo && orderNo !== 'SO-AUTO' ? orderNo : yield (0, exports.getNextSalesOrderSequence)();
    let customerId = null;
    if (customer) {
        const ledger = yield db_1.prisma.ledger.findFirst({
            where: { accountName: customer }
        });
        if (ledger) {
            customerId = new mongodb_1.ObjectId(ledger.id);
        }
    }
    const advance = Number(advancePaid) || 0;
    const grandTotal = Number(summary.grandTotal) || 0;
    const balanceAmount = Math.max(0, grandTotal - advance);
    let parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
    if (isNaN(parsedOrderDate.getTime()))
        parsedOrderDate = new Date();
    let parsedDeliveryDate = deliveryDate ? new Date(deliveryDate) : parsedOrderDate;
    if (isNaN(parsedDeliveryDate.getTime()))
        parsedDeliveryDate = parsedOrderDate;
    const orderResult = yield db.collection('SalesOrder').insertOne({
        orderNumber,
        customerId,
        buyerName: customer || 'CASH CUSTOMER',
        mobileNo: mobileNo || '',
        address: address || '',
        orderDate: parsedOrderDate,
        expectedDeliveryDate: parsedDeliveryDate,
        status: status || 'Open',
        subtotal: Number(summary.subtotal) || 0,
        discount: Number(summary.discount) || 0,
        cgst: Number(summary.cgst) || 0,
        sgst: Number(summary.sgst) || 0,
        roundOff: Number(summary.rounding) || 0,
        grandTotal,
        advancePaid: advance,
        balanceAmount,
        remarks,
        salesman,
        paymentMode: paymentMode || 'Cash',
        createdAt: new Date(),
        updatedAt: new Date()
    });
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            let productId = item.productId ? new mongodb_1.ObjectId(item.productId) : null;
            if (!productId && item.itemCode) {
                const prod = yield db_1.prisma.product.findUnique({
                    where: { itemCode: item.itemCode }
                });
                if (prod) {
                    productId = new mongodb_1.ObjectId(prod.id);
                }
            }
            const qty = Number(item.quantityOrdered) || 0;
            itemsToInsert.push({
                salesOrderId: orderResult.insertedId,
                productId,
                itemCode: item.itemCode,
                itemName: item.itemDescription || item.itemName,
                color: item.color || null,
                size: item.size || null,
                orderedQty: qty,
                deliveredQty: 0,
                pendingQty: qty,
                unitPrice: Number(item.unitPrice) || 0,
                discount: Number(item.discountPercentage) || 0,
                tax: Number(item.taxRatePercentage) || 0,
                lineTotal: Number(item.lineSubTotal) || 0
            });
        }
        yield db.collection('SalesOrderItem').insertMany(itemsToInsert);
    }
    return { id: orderResult.insertedId.toString(), orderNumber };
});
exports.createSalesOrder = createSalesOrder;
const searchSalesOrders = (q) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const db = yield (0, db_1.getDb)();
    let filter = {};
    if (q) {
        const regex = new RegExp(q, 'i');
        filter = {
            $or: [
                { orderNumber: regex },
                { buyerName: regex },
                { mobileNo: regex }
            ]
        };
    }
    const orders = yield db.collection('SalesOrder').find(filter).sort({ createdAt: -1 }).toArray();
    const orderIds = orders.map(o => o._id);
    const items = yield db.collection('SalesOrderItem').find({ salesOrderId: { $in: orderIds } }).toArray();
    const itemMap = new Map();
    for (const item of items) {
        const key = (_a = item.salesOrderId) === null || _a === void 0 ? void 0 : _a.toString();
        if (!itemMap.has(key))
            itemMap.set(key, []);
        itemMap.get(key).push(Object.assign(Object.assign({}, item), { id: (_b = item._id) === null || _b === void 0 ? void 0 : _b.toString() }));
    }
    return orders.map(o => (Object.assign(Object.assign({}, o), { id: o._id.toString(), _id: o._id.toString(), items: itemMap.get(o._id.toString()) || [] })));
});
exports.searchSalesOrders = searchSalesOrders;
const getSalesOrderDetails = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    let order = null;
    try {
        order = yield db.collection('SalesOrder').findOne({ _id: new mongodb_1.ObjectId(id) });
    }
    catch (e) {
        order = yield db.collection('SalesOrder').findOne({ orderNumber: id });
    }
    if (!order)
        return null;
    const items = yield db.collection('SalesOrderItem').find({ salesOrderId: order._id }).toArray();
    return Object.assign(Object.assign({}, order), { id: order._id.toString(), _id: order._id.toString(), items: items.map(i => { var _a; return (Object.assign(Object.assign({}, i), { id: (_a = i._id) === null || _a === void 0 ? void 0 : _a.toString() })); }) });
});
exports.getSalesOrderDetails = getSalesOrderDetails;
const updateSalesOrder = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderNo, orderDate, customer, deliveryDate, status, isInterstate, summary, items, mobileNo, address, remarks, salesman, advancePaid, paymentMode } = data;
    const db = yield (0, db_1.getDb)();
    const orderId = new mongodb_1.ObjectId(id);
    const existingOrder = yield db.collection('SalesOrder').findOne({ _id: orderId });
    if (!existingOrder)
        return false;
    if (existingOrder.status === 'Completed' || existingOrder.status === 'Cancelled') {
        throw new Error('Completed or Cancelled orders cannot be modified.');
    }
    let customerId = null;
    if (customer) {
        const ledger = yield db.collection('Ledger').findOne({ accountName: customer });
        if (ledger) {
            customerId = ledger._id;
        }
    }
    const advance = Number(advancePaid) || 0;
    const grandTotal = Number(summary === null || summary === void 0 ? void 0 : summary.grandTotal) || Number(data.grandTotal) || 0;
    const balanceAmount = Math.max(0, grandTotal - advance);
    let parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
    if (isNaN(parsedOrderDate.getTime()))
        parsedOrderDate = new Date();
    let parsedDeliveryDate = deliveryDate ? new Date(deliveryDate) : parsedOrderDate;
    if (isNaN(parsedDeliveryDate.getTime()))
        parsedDeliveryDate = parsedOrderDate;
    yield db.collection('SalesOrder').updateOne({ _id: orderId }, {
        $set: {
            orderNumber: orderNo || existingOrder.orderNumber,
            customerId,
            buyerName: customer || 'CASH CUSTOMER',
            mobileNo: mobileNo || '',
            address: address || '',
            orderDate: parsedOrderDate,
            expectedDeliveryDate: parsedDeliveryDate,
            status: status || existingOrder.status,
            subtotal: Number(summary === null || summary === void 0 ? void 0 : summary.subtotal) || 0,
            discount: Number(summary === null || summary === void 0 ? void 0 : summary.discount) || 0,
            cgst: Number(summary === null || summary === void 0 ? void 0 : summary.cgst) || 0,
            sgst: Number(summary === null || summary === void 0 ? void 0 : summary.sgst) || 0,
            roundOff: Number(summary === null || summary === void 0 ? void 0 : summary.rounding) || 0,
            grandTotal,
            advancePaid: advance,
            balanceAmount,
            remarks,
            salesman,
            paymentMode: paymentMode || 'Cash',
            updatedAt: new Date()
        }
    });
    // Delete existing items
    yield db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });
    if (items && items.length > 0) {
        const itemsToInsert = [];
        for (const item of items) {
            let productId = item.productId ? new mongodb_1.ObjectId(item.productId) : null;
            if (!productId && item.itemCode) {
                const prod = yield db.collection('Product').findOne({ itemCode: item.itemCode });
                if (prod) {
                    productId = prod._id;
                }
            }
            const qty = Number(item.quantityOrdered) || Number(item.orderedQty) || 0;
            const delivered = Number(item.quantityFulfilled) || Number(item.deliveredQty) || 0;
            itemsToInsert.push({
                salesOrderId: orderId,
                productId,
                itemCode: item.itemCode,
                itemName: item.itemDescription || item.itemName,
                color: item.color || null,
                size: item.size || null,
                orderedQty: qty,
                deliveredQty: delivered,
                pendingQty: Math.max(0, qty - delivered),
                unitPrice: Number(item.unitPrice) || 0,
                discount: Number(item.discountPercentage) || 0,
                tax: Number(item.taxRatePercentage) || 0,
                lineTotal: Number(item.lineSubTotal) || Number(item.lineTotal) || 0
            });
        }
        yield db.collection('SalesOrderItem').insertMany(itemsToInsert);
    }
    return true;
});
exports.updateSalesOrder = updateSalesOrder;
const deleteSalesOrder = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, db_1.getDb)();
    const orderId = new mongodb_1.ObjectId(id);
    yield db.collection('SalesOrderItem').deleteMany({ salesOrderId: orderId });
    const result = yield db.collection('SalesOrder').deleteOne({ _id: orderId });
    return result.deletedCount > 0;
});
exports.deleteSalesOrder = deleteSalesOrder;
const cancelSalesOrder = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { cancelReason, cancelledBy } = data;
    const db = yield (0, db_1.getDb)();
    const orderId = new mongodb_1.ObjectId(id);
    const result = yield db.collection('SalesOrder').updateOne({ _id: orderId }, {
        $set: {
            status: 'Cancelled',
            cancelReason: cancelReason || 'User request',
            cancelledBy: cancelledBy || 'System',
            cancelDate: new Date(),
            updatedAt: new Date()
        }
    });
    return result.matchedCount > 0;
});
exports.cancelSalesOrder = cancelSalesOrder;
