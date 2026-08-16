import { Request, Response } from 'express';
import * as cashDrawerService from '../services/cashDrawer.service';

export const getTodayOpeningCash = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const result = await cashDrawerService.getTodayOpeningCash(dateStr);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error fetching today opening cash:", error);
    res.status(500).json({ success: false, error: 'Failed to fetch opening cash status', details: error.message });
  }
};

export const saveOpeningCash = async (req: Request, res: Response) => {
  try {
    const record = await cashDrawerService.saveOpeningCash(req.body);
    res.json({ success: true, data: record });
  } catch (error: any) {
    console.error("Error saving opening cash:", error);
    res.status(500).json({ success: false, error: 'Failed to save opening cash', details: error.message });
  }
};

export const getOpeningCashHistory = async (req: Request, res: Response) => {
  try {
    const history = await cashDrawerService.getOpeningCashHistory();
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error("Error fetching opening cash history:", error);
    res.status(500).json({ success: false, error: 'Failed to fetch opening cash history', details: error.message });
  }
};
