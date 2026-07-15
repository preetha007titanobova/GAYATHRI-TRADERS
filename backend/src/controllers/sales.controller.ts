import { Request, Response } from 'express';
import * as salesService from '../services/sales.service';

export const getNextInvoice = async (req: Request, res: Response) => {
  try {
    const invoiceNo = await salesService.getNextInvoice();
    res.json({ invoiceNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice sequence' });
  }
};

export const createSalesBill = async (req: Request, res: Response) => {
  try {
    const bill = await salesService.createSalesBill(req.body);
    res.json({ success: true, bill });
  } catch (error: any) {
    console.error("Sales Bill Error:", error);
    res.status(500).json({ error: 'Failed to save sales bill', details: error.message });
  }
};

export const updateSalesBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.updateSalesBill(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Sales bill not found' });
    }
    res.json({ success: true, message: 'Sales Bill updated successfully' });
  } catch (error: any) {
    console.error("Update Sales Bill Error:", error);
    res.status(500).json({ error: 'Failed to update sales bill', details: error.message });
  }
};

export const deleteSalesBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.deleteSalesBill(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Sales bill not found' });
    }
    res.json({ success: true, message: 'Sales Bill deleted successfully' });
  } catch (error: any) {
    console.error("Delete Sales Bill Error:", error);
    res.status(500).json({ error: 'Failed to delete sales bill', details: error.message });
  }
};

export const searchSalesBills = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const bills = await salesService.searchSalesBills(q);
    res.json(bills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search sales bills' });
  }
};

export const getSalesBillByInvoiceNo = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params;
    const bill = await salesService.getSalesBillByInvoiceNo(invoiceNo as string);
    if (!bill) {
      return res.status(404).json({ error: 'Sales bill not found' });
    }
    res.json(bill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sales bill details' });
  }
};

export const createSalesOrder = async (req: Request, res: Response) => {
  try {
    const order = await salesService.createSalesOrder(req.body);
    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Sales Order Error:", error);
    res.status(500).json({ error: 'Failed to save sales order', details: error.message });
  }
};

export const searchSalesOrders = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const orders = await salesService.searchSalesOrders(q);
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search sales orders' });
  }
};

export const getSalesOrderDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await salesService.getSalesOrderDetails(id as string);
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error("Get Sales Order Details Error:", error);
    res.status(500).json({ error: 'Failed to fetch sales order details' });
  }
};

export const updateSalesOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.updateSalesOrder(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    res.json({ success: true, message: 'Sales Order updated successfully' });
  } catch (error: any) {
    console.error("Update Sales Order Error:", error);
    res.status(500).json({ error: 'Failed to update sales order', details: error.message });
  }
};

export const deleteSalesOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.deleteSalesOrder(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    res.json({ success: true, message: 'Sales Order deleted successfully' });
  } catch (error: any) {
    console.error("Delete Sales Order Error:", error);
    res.status(500).json({ error: 'Failed to delete sales order', details: error.message });
  }
};

export const getNextSalesReturnSequence = async (req: Request, res: Response) => {
  try {
    const returnNo = await salesService.getNextSalesReturnSequence();
    res.json({ returnNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate return sequence' });
  }
};

export const createSalesReturn = async (req: Request, res: Response) => {
  try {
    const returnNote = await salesService.createSalesReturn(req.body);
    res.json({ success: true, returnNote });
  } catch (error: any) {
    console.error("Sales Return Error:", error);
    res.status(500).json({ error: 'Failed to save sales return', details: error.message });
  }
};

export const searchSalesReturns = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const returns = await salesService.searchSalesReturns(q);
    res.json(returns);
  } catch (error) {
    console.error("Search Sales Returns Error:", error);
    res.status(500).json({ error: 'Failed to search sales returns' });
  }
};

export const getSalesReturnDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const salesReturn = await salesService.getSalesReturnDetails(id as string);
    if (!salesReturn) {
      return res.status(404).json({ error: 'Sales return not found' });
    }
    res.json(salesReturn);
  } catch (error) {
    console.error("Get Sales Return Details Error:", error);
    res.status(500).json({ error: 'Failed to fetch sales return details' });
  }
};

export const updateSalesReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.updateSalesReturn(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Sales return not found' });
    }
    res.json({ success: true, message: 'Sales Return updated successfully' });
  } catch (error: any) {
    console.error("Update Sales Return Error:", error);
    res.status(500).json({ error: 'Failed to update sales return', details: error.message });
  }
};

export const deleteSalesReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await salesService.deleteSalesReturn(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Sales return not found' });
    }
    res.json({ success: true, message: 'Sales Return deleted successfully' });
  } catch (error: any) {
    console.error("Delete Sales Return Error:", error);
    res.status(500).json({ error: 'Failed to delete sales return', details: error.message });
  }
};

export const getStockLedger = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const data = await salesService.getStockLedger(productId as string);
    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Stock Ledger Error:', error);
    res.status(500).json({ error: 'Failed to fetch stock ledger' });
  }
};

export const getSalesStatusReport = async (req: Request, res: Response) => {
  try {
    const report = await salesService.getSalesStatusReport();
    res.json(report);
  } catch (error: any) {
    console.error("Sales Status Report Error:", error);
    res.status(500).json({ error: 'Failed to fetch sales status report', details: error.message });
  }
};

export const getReturnsByInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params;
    const data = await salesService.getReturnsByInvoice(invoiceNo as string);
    res.json(data);
  } catch (error: any) {
    console.error("Get Returns By Invoice Error:", error);
    res.status(500).json({ error: 'Failed to fetch returns by invoice', details: error.message });
  }
};
