const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

router.post('/ask', queryController.ask);
router.post('/sync/:id', queryController.syncSchema);

module.exports = router;
