import { Request, Response } from 'express';
import * as purchaseService from '../services/purchase.service';

export const getNextPurchaseVoucher = async (req: Request, res: Response) => {
  try {
    const voucherNo = await purchaseService.getNextPurchaseVoucher();
    res.json({ voucherNo });
  } catch (error: any) {
    console.error("Error generating purchase voucher:", error);
    res.status(500).json({ error: 'Failed to generate voucher sequence', details: error.message });
  }
};

export const createPurchaseBill = async (req: Request, res: Response) => {
  try {
    const bill = await purchaseService.createPurchaseBill(req.body);
    res.json({ success: true, bill });
  } catch (error: any) {
    console.error("Error saving purchase bill:", error);
    res.status(500).json({ error: 'Failed to save purchase bill', details: error.message });
  }
};

export const searchPurchaseBills = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const bills = await purchaseService.searchPurchaseBills(q);
    res.json(bills);
  } catch (error: any) {
    console.error("Error searching purchase bills:", error);
    res.status(500).json({ error: 'Failed to search purchase bills', details: error.message });
  }
};

export const getPurchaseBillById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bill = await purchaseService.getPurchaseBillById(id as string);
    if (!bill) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }
    res.json(bill);
  } catch (error: any) {
    console.error("Error fetching purchase bill by ID:", error);
    res.status(500).json({ error: 'Failed to fetch purchase bill', details: error.message });
  }
};

export const updatePurchaseBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await purchaseService.updatePurchaseBill(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }
    res.json({ success: true, message: 'Purchase bill updated successfully' });
  } catch (error: any) {
    console.error("Error updating purchase bill:", error);
    res.status(500).json({ error: 'Failed to update purchase bill', details: error.message });
  }
};

export const deletePurchaseBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await purchaseService.deletePurchaseBill(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }
    res.json({ success: true, message: 'Purchase bill deleted successfully' });
  } catch (error: any) {
    console.error("Error deleting purchase bill:", error);
    res.status(500).json({ error: 'Failed to delete purchase bill', details: error.message });
  }
};

export const getNextPurchaseReturnVoucher = async (req: Request, res: Response) => {
  try {
    const returnNo = await purchaseService.getNextPurchaseReturnVoucher();
    res.json({ returnNo });
  } catch (error: any) {
    console.error("Error generating purchase return voucher:", error);
    res.status(500).json({ error: 'Failed to generate return voucher sequence', details: error.message });
  }
};

export const createPurchaseReturn = async (req: Request, res: Response) => {
  try {
    const ret = await purchaseService.createPurchaseReturn(req.body);
    res.json({ success: true, return: ret });
  } catch (error: any) {
    console.error("Error saving purchase return:", error);
    res.status(500).json({ error: 'Failed to save purchase return', details: error.message });
  }
};

export const searchPurchaseReturns = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const returns = await purchaseService.searchPurchaseReturns(q);
    res.json(returns);
  } catch (error: any) {
    console.error("Error searching purchase returns:", error);
    res.status(500).json({ error: 'Failed to search purchase returns', details: error.message });
  }
};

export const updatePurchaseReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await purchaseService.updatePurchaseReturn(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Purchase return not found' });
    }
    res.json({ success: true, message: 'Purchase return updated successfully' });
  } catch (error: any) {
    console.error("Error updating purchase return:", error);
    res.status(500).json({ error: 'Failed to update purchase return', details: error.message });
  }
};

export const deletePurchaseReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await purchaseService.deletePurchaseReturn(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Purchase return not found' });
    }
    res.json({ success: true, message: 'Purchase return deleted successfully' });
  } catch (error: any) {
    console.error("Error deleting purchase return:", error);
    res.status(500).json({ error: 'Failed to delete purchase return', details: error.message });
  }
};
