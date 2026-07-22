import { Request, Response } from 'express';
import * as ledgerService from '../services/ledger.service';

export const getNextLedgerCode = async (req: Request, res: Response) => {
  try {
    const ledgerCode = await ledgerService.getNextLedgerCode();
    res.json({ ledgerCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate ledger code' });
  }
};

export const searchLedgers = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const group = req.query.group as string || '';
    const ledgers = await ledgerService.searchLedgers(q, group);
    res.json(ledgers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search ledgers' });
  }
};

export const createLedger = async (req: Request, res: Response) => {
  try {
    const result = await ledgerService.createLedger(req.body);
    res.json({ 
      success: true, 
      ledger: { 
        id: result.insertedId.toString(), 
        ledgerCode: req.body.ledgerCode, 
        accountName: req.body.accountName 
      } 
    });
  } catch (error: any) {
    console.error("Ledger Error:", error);
    res.status(500).json({ error: 'Failed to save ledger', details: error.message });
  }
};

export const updateLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ledgerService.updateLedger(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Ledger not found' });
    }
    res.json({ success: true, message: 'Ledger updated successfully' });
  } catch (error: any) {
    console.error("Update Ledger Error:", error);
    res.status(500).json({ error: 'Failed to update ledger', details: error.message });
  }
};

export const deleteLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ledgerService.deleteLedger(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Ledger not found' });
    }
    res.json({ success: true, message: 'Ledger deleted successfully' });
  } catch (error: any) {
    console.error("Delete Ledger Error:", error);
    res.status(500).json({ error: 'Failed to delete ledger', details: error.message });
  }
};

export const getLedgerStatement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;
    const statement = await ledgerService.getLedgerStatement(
      id as string,
      fromDate as string || '',
      toDate as string || ''
    );
    res.json(statement);
  } catch (error: any) {
    console.error("Ledger Statement Error:", error);
    res.status(500).json({ error: 'Failed to compile ledger statement', details: error.message });
  }
};
