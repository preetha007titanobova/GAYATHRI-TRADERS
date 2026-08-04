"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./polyfill");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("./config/db");
const routes_1 = __importDefault(require("./routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
app.use(express_1.default.json());
// Mount API routes under /api/v1
app.use('/api/v1', routes_1.default);
// Serve frontend static assets from the compiled production build
const possibleDistPaths = [
    process.env.FRONTEND_DIST_PATH,
    path_1.default.join(__dirname, '..', 'frontend', 'dist'),
    path_1.default.join(__dirname, '..', '..', 'frontend', 'dist'),
    path_1.default.join(__dirname, 'frontend', 'dist'),
    path_1.default.join(process.cwd(), 'frontend', 'dist'),
    path_1.default.join(process.cwd(), 'resources', 'app', 'frontend', 'dist'),
    path_1.default.join(process.cwd(), 'resources', 'frontend', 'dist')
].filter((p) => !!p && fs_1.default.existsSync(p));
const distPath = possibleDistPaths[0] || path_1.default.join(__dirname, '..', 'frontend', 'dist');
console.log('Serving frontend dist from:', distPath);
app.use(express_1.default.static(distPath));
// For all non-API paths, return the index.html template (enables React Router paths like /activation)
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = path_1.default.join(distPath, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.status(404).send('Frontend static files not found. Expected index.html at: ' + indexPath);
});
// Set up collections & indexes
(0, db_1.setupDatabase)();
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
