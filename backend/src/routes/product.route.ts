import { Router } from 'express';
import * as productController from '../controllers/product.controller';

const router = Router();

router.get('/search', productController.searchItems);
router.post('/seed', productController.seedMockItems);
router.get('/next-code', productController.getNextProductCode);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router;
