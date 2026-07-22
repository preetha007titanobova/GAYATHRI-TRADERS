import { Request, Response } from 'express';
import * as shopSalesService from '../services/shopSales.service';

export const getNextShopSalesVoucher = async (req: Request, res: Response) => {
  try {
    const voucherNo = await shopSalesService.getNextShopSalesVoucher();
    res.json({ voucherNo });
  } catch (error: any) {
    console.error("Error generating shop sales voucher:", error);
    res.status(500).json({ error: 'Failed to generate voucher sequence', details: error.message });
  }
};

export const createShopSalesBill = async (req: Request, res: Response) => {
  try {
    const bill = await shopSalesService.createShopSalesBill(req.body);
    res.json({ success: true, bill });
  } catch (error: any) {
    console.error("Error saving shop sales bill:", error);
    res.status(500).json({ error: 'Failed to save shop sales bill', details: error.message });
  }
};

export const searchShopSalesBills = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const bills = await shopSalesService.searchShopSalesBills(q);
    res.json(bills);
  } catch (error: any) {
    console.error("Error searching shop sales bills:", error);
    res.status(500).json({ error: 'Failed to search shop sales bills', details: error.message });
  }
};

export const updateShopSalesBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await shopSalesService.updateShopSalesBill(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Shop sales bill not found' });
    }
    res.json({ success: true, message: 'Shop sales bill updated successfully' });
  } catch (error: any) {
    console.error("Error updating shop sales bill:", error);
    res.status(500).json({ error: 'Failed to update shop sales bill', details: error.message });
  }
};

export const deleteShopSalesBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await shopSalesService.deleteShopSalesBill(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Shop sales bill not found' });
    }
    res.json({ success: true, message: 'Shop sales bill deleted successfully' });
  } catch (error: any) {
    console.error("Error deleting shop sales bill:", error);
    res.status(500).json({ error: 'Failed to delete shop sales bill', details: error.message });
  }
};
