import { Request, Response } from 'express';
import * as quotationService from '../services/quotation.service';

export const sendEmail = async (req: Request, res: Response) => {
  try {
    await quotationService.sendQuotationEmail(req.body);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email Error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

export const getNextSequence = async (req: Request, res: Response) => {
  try {
    const quoteNo = await quotationService.getNextSequence();
    res.json({ quoteNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate quotation sequence' });
  }
};
