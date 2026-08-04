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

export const createQuotation = async (req: Request, res: Response) => {
  try {
    const quote = await quotationService.createQuotation(req.body);
    res.json({ success: true, quotation: quote });
  } catch (error: any) {
    console.error('Create Quotation Error:', error);
    res.status(500).json({ error: 'Failed to save quotation', details: error.message });
  }
};

export const getQuotations = async (req: Request, res: Response) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const quotes = await quotationService.getQuotations({ startDate, endDate, q });
    res.json(quotes);
  } catch (error: any) {
    console.error('Get Quotations Error:', error);
    res.status(500).json({ error: 'Failed to fetch quotations', details: error.message });
  }
};

export const getQuotationById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const quote = await quotationService.getQuotationById(id);
    if (!quote) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.json(quote);
  } catch (error: any) {
    console.error('Get Quotation By Id Error:', error);
    res.status(500).json({ error: 'Failed to fetch quotation', details: error.message });
  }
};

export const deleteQuotation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const success = await quotationService.deleteQuotation(id);
    if (success) {
      res.json({ success: true, message: 'Quotation deleted successfully' });
    } else {
      res.status(404).json({ error: 'Quotation not found or already deleted' });
    }
  } catch (error: any) {
    console.error('Delete Quotation Error:', error);
    res.status(500).json({ error: 'Failed to delete quotation', details: error.message });
  }
};
