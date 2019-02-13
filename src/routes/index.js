// api/src/routes/index.js

import express from 'express';
import Bot from '../controllers/bot';
import DB from '../controllers/db';
// import api from './api';

const router = express.Router();

// middleware
router.use((req, res, next) => {
  next();
});

// server routes ============================================================
router.route('/bot').post(Bot.post);
router.route('/api/setup').get(DB.setup);
router.route('/api/refresh').get(DB.refresh);
router.route('/api/count').get(DB.countQuery);

export default router;
