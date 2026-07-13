import { Router } from 'express';
import * as productController from '../controllers/product.controller';

const router = Router();

router.get('/search', productController.searchItems);
router.get('/daily-status', productController.getDailyStockStatus);
router.post('/close-day', productController.closeDay);
router.post('/upload-pdf', productController.uploadPdf);
router.post('/seed', productController.seedMockItems);
router.get('/next-code', productController.getNextProductCode);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router;
