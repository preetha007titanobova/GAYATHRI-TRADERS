import { Request, Response } from 'express';
import { prisma } from '../config/db';
import * as productService from '../services/product.service';
import * as notificationService from '../services/notification.service';

export const searchItems = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const products = await productService.searchItems(q);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search items' });
  }
};

export const seedMockItems = async (req: Request, res: Response) => {
  try {
    const items = [
      { name: 'Almonds Premium 1kg', price: 15.99, stock: 100, barcode: 'A123' },
      { name: 'Walnuts Organic 500g', price: 12.50, stock: 50, barcode: 'W456' },
      { name: 'Cashews Roasted 250g', price: 8.00, stock: 200, barcode: 'C789' }
    ];
    
    for (const item of items) {
      await prisma.product.upsert({
        where: { barcode: item.barcode },
        update: {},
        create: {
          name: item.name,
          price: item.price,
          stock: item.stock,
          barcode: item.barcode
        }
      });
    }
    res.json({ success: true, message: 'Mock data seeded' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Seeding failed', details: error.message });
  }
};

export const getNextProductCode = async (req: Request, res: Response) => {
  try {
    const itemCode = await productService.getNextProductCode();
    res.json({ itemCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate item code' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const result = await productService.createProduct(req.body);
    res.json({ 
      success: true, 
      product: { 
        id: result.insertedId.toString(), 
        itemCode: req.body.itemCode, 
        name: req.body.name 
      } 
    });
  } catch (error: any) {
    console.error("Product Error:", error);
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      if (error.message.includes('barcode')) {
        return res.status(400).json({ error: 'A product with this barcode already exists.', details: error.message });
      }
      if (error.message.includes('itemCode')) {
        return res.status(400).json({ error: 'Item Code already exists. Please refresh the page to get the next available code.', details: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to save product', details: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await productService.updateProduct(id as string, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error: any) {
    console.error("Update Product Error:", error);
    
    if (error.code === 11000) {
      if (error.message.includes('barcode')) {
        return res.status(400).json({ error: 'A product with this barcode already exists.', details: error.message });
      }
      if (error.message.includes('itemCode')) {
        return res.status(400).json({ error: 'Item Code already exists. Please refresh the page to get the next available code.', details: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await productService.deleteProduct(id as string);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
};

export const getDailyStockStatus = async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const data = await productService.getDailyStockStatus(date);
    res.json(data);
  } catch (error: any) {
    console.error("Daily Stock Status Error:", error);
    res.status(500).json({ error: 'Failed to fetch daily stock status', details: error.message });
  }
};

export const closeDay = async (req: Request, res: Response) => {
  try {
    const { date, pdf, email } = req.body;
    if (!pdf) {
      return res.status(400).json({ error: 'PDF data is required' });
    }
    
    const filename = `Daily_Stock_Status_${date?.replace(/-/g, '_')}.pdf`;
    const pdfUrl = await notificationService.uploadPdfToTmpFiles(pdf, filename);
    
    const emailSuccess = await notificationService.sendCloseDayEmail(date, pdf, email);
    
    res.json({ 
      success: true, 
      emailSuccess, 
      pdfUrl, 
      message: 'Close Day completed' 
    });
  } catch (error: any) {
    console.error("Close Day Error:", error);
    res.status(500).json({ error: 'Failed to complete Close Day', details: error.message });
  }
};

export const uploadPdf = async (req: Request, res: Response) => {
  try {
    const { pdf, filename } = req.body;
    if (!pdf) {
      return res.status(400).json({ error: 'PDF data is required' });
    }
    const pdfUrl = await notificationService.uploadPdfToTmpFiles(pdf, filename || 'report.pdf');
    res.json({ success: true, pdfUrl });
  } catch (error: any) {
    console.error("Upload PDF Error:", error);
    res.status(500).json({ error: 'Failed to upload PDF', details: error.message });
  }
};

