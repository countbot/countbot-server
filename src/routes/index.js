// api/src/routes/index.js

import express from 'express';
import Bot from '../controllers/bot';
import DB from '../controllers/db';
import Troll from '../controllers/troll';
// import api from './api';

const router = express.Router();

// middleware
router.use((req, res, next) => {
  next();
});

// server routes ============================================================
router.route('/bot').post(Bot.post);
router.route('/setup').get(DB.setup);
router.route('/refresh').get(DB.refresh);
router.route('/roles').get(DB.roles);
router.route('/messages').get(DB.getMessages);
router.route('/message').get(DB.getMessage);
router.route('/troll').get(Troll.get);

export default router;
