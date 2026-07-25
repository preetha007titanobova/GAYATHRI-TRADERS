
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  role: 'role',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  itemCode: 'itemCode',
  name: 'name',
  barcode: 'barcode',
  uom: 'uom',
  purchaseRate: 'purchaseRate',
  price: 'price',
  mrp: 'mrp',
  taxPercent: 'taxPercent',
  stock: 'stock',
  committedStock: 'committedStock',
  categoryId: 'categoryId',
  department: 'department',
  variety: 'variety',
  size: 'size',
  factory: 'factory',
  vendorItemCode: 'vendorItemCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SalesBillScalarFieldEnum = {
  id: 'id',
  invoiceNo: 'invoiceNo',
  invDate: 'invDate',
  payDays: 'payDays',
  buyerName: 'buyerName',
  address: 'address',
  eType: 'eType',
  mobileNo: 'mobileNo',
  gstNo: 'gstNo',
  printIn: 'printIn',
  invFormat: 'invFormat',
  paymentMode: 'paymentMode',
  totalQty: 'totalQty',
  totalAmount: 'totalAmount',
  cgst: 'cgst',
  sgst: 'sgst',
  roundOff: 'roundOff',
  netAmount: 'netAmount',
  remarks: 'remarks',
  shippingAddress: 'shippingAddress',
  userId: 'userId',
  createdAt: 'createdAt'
};

exports.Prisma.SalesItemScalarFieldEnum = {
  id: 'id',
  salesBillId: 'salesBillId',
  productId: 'productId',
  itemName: 'itemName',
  itemDesc: 'itemDesc',
  qty: 'qty',
  uom: 'uom',
  rate: 'rate',
  discPercent: 'discPercent',
  discAmt: 'discAmt',
  amount: 'amount'
};

exports.Prisma.LedgerScalarFieldEnum = {
  id: 'id',
  ledgerCode: 'ledgerCode',
  accountName: 'accountName',
  accountGroup: 'accountGroup',
  contactPerson: 'contactPerson',
  mobileNo: 'mobileNo',
  email: 'email',
  panNo: 'panNo',
  address: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  gstNo: 'gstNo',
  bankName: 'bankName',
  accountNo: 'accountNo',
  ifscCode: 'ifscCode',
  openingBalance: 'openingBalance',
  drCr: 'drCr',
  creditLimit: 'creditLimit',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SalesReturnScalarFieldEnum = {
  id: 'id',
  returnNo: 'returnNo',
  returnDate: 'returnDate',
  originalInvoice: 'originalInvoice',
  customerName: 'customerName',
  reason: 'reason',
  paymentMode: 'paymentMode',
  totalReturnAmount: 'totalReturnAmount',
  cgstReturn: 'cgstReturn',
  sgstReturn: 'sgstReturn',
  igstReturn: 'igstReturn',
  roundOff: 'roundOff',
  netRefundAmount: 'netRefundAmount',
  userId: 'userId',
  createdAt: 'createdAt'
};

exports.Prisma.SalesReturnItemScalarFieldEnum = {
  id: 'id',
  salesReturnId: 'salesReturnId',
  productId: 'productId',
  itemCode: 'itemCode',
  itemName: 'itemName',
  invoicedQty: 'invoicedQty',
  returnQty: 'returnQty',
  unitPrice: 'unitPrice',
  taxableAmt: 'taxableAmt',
  taxPercent: 'taxPercent',
  disposition: 'disposition',
  subtotal: 'subtotal'
};

exports.Prisma.PurchaseBillScalarFieldEnum = {
  id: 'id',
  voucherNo: 'voucherNo',
  date: 'date',
  supplierInvoiceNo: 'supplierInvoiceNo',
  supplierName: 'supplierName',
  supplierGstin: 'supplierGstin',
  taxableAmt: 'taxableAmt',
  cgst: 'cgst',
  sgst: 'sgst',
  igst: 'igst',
  otherCharges: 'otherCharges',
  netPayable: 'netPayable',
  status: 'status',
  type: 'type',
  paymentMode: 'paymentMode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseItemScalarFieldEnum = {
  id: 'id',
  purchaseBillId: 'purchaseBillId',
  productId: 'productId',
  itemCode: 'itemCode',
  itemName: 'itemName',
  size: 'size',
  variety: 'variety',
  category: 'category',
  factory: 'factory',
  vendorItemCode: 'vendorItemCode',
  qty: 'qty',
  rate: 'rate',
  taxPercent: 'taxPercent',
  discPercent: 'discPercent',
  total: 'total'
};

exports.Prisma.SalesOrderScalarFieldEnum = {
  id: 'id',
  orderNumber: 'orderNumber',
  customerId: 'customerId',
  buyerName: 'buyerName',
  mobileNo: 'mobileNo',
  address: 'address',
  orderDate: 'orderDate',
  expectedDeliveryDate: 'expectedDeliveryDate',
  status: 'status',
  subtotal: 'subtotal',
  discount: 'discount',
  cgst: 'cgst',
  sgst: 'sgst',
  roundOff: 'roundOff',
  grandTotal: 'grandTotal',
  advancePaid: 'advancePaid',
  balanceAmount: 'balanceAmount',
  remarks: 'remarks',
  salesman: 'salesman',
  paymentMode: 'paymentMode',
  cancelReason: 'cancelReason',
  cancelDate: 'cancelDate',
  cancelledBy: 'cancelledBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SalesOrderItemScalarFieldEnum = {
  id: 'id',
  salesOrderId: 'salesOrderId',
  productId: 'productId',
  itemCode: 'itemCode',
  itemName: 'itemName',
  color: 'color',
  size: 'size',
  orderedQty: 'orderedQty',
  deliveredQty: 'deliveredQty',
  pendingQty: 'pendingQty',
  unitPrice: 'unitPrice',
  discount: 'discount',
  tax: 'tax',
  lineTotal: 'lineTotal'
};

exports.Prisma.StaffScalarFieldEnum = {
  id: 'id',
  staffCode: 'staffCode',
  name: 'name',
  role: 'role',
  mobileNo: 'mobileNo',
  email: 'email',
  salary: 'salary',
  dailyRate: 'dailyRate',
  joiningDate: 'joiningDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffAttendanceScalarFieldEnum = {
  id: 'id',
  staffId: 'staffId',
  date: 'date',
  status: 'status',
  checkIn: 'checkIn',
  checkOut: 'checkOut',
  remarks: 'remarks',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ShopSalesBillScalarFieldEnum = {
  id: 'id',
  voucherNo: 'voucherNo',
  date: 'date',
  shopName: 'shopName',
  shopGstin: 'shopGstin',
  taxableAmt: 'taxableAmt',
  cgst: 'cgst',
  sgst: 'sgst',
  igst: 'igst',
  otherCharges: 'otherCharges',
  netPayable: 'netPayable',
  status: 'status',
  type: 'type',
  paymentMode: 'paymentMode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ShopSalesItemScalarFieldEnum = {
  id: 'id',
  shopSalesBillId: 'shopSalesBillId',
  productId: 'productId',
  itemCode: 'itemCode',
  itemName: 'itemName',
  size: 'size',
  variety: 'variety',
  category: 'category',
  factory: 'factory',
  vendorItemCode: 'vendorItemCode',
  qty: 'qty',
  rate: 'rate',
  taxPercent: 'taxPercent',
  discPercent: 'discPercent',
  total: 'total'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};


exports.Prisma.ModelName = {
  User: 'User',
  Category: 'Category',
  Product: 'Product',
  SalesBill: 'SalesBill',
  SalesItem: 'SalesItem',
  Ledger: 'Ledger',
  SalesReturn: 'SalesReturn',
  SalesReturnItem: 'SalesReturnItem',
  PurchaseBill: 'PurchaseBill',
  PurchaseItem: 'PurchaseItem',
  SalesOrder: 'SalesOrder',
  SalesOrderItem: 'SalesOrderItem',
  Staff: 'Staff',
  StaffAttendance: 'StaffAttendance',
  ShopSalesBill: 'ShopSalesBill',
  ShopSalesItem: 'ShopSalesItem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
