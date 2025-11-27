const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

router.post('/sync/:id', queryController.syncSchema);
router.post('/starter-questions', queryController.getStarterQuestions);
router.post('/ask', queryController.ask);
router.post('/conversation', queryController.createConversation);
router.get('/conversations/:connectionId', queryController.getConversations);
router.get('/conversation/:id/messages', queryController.getConversationMessages);
router.patch('/conversation/:id', queryController.updateConversation);

module.exports = router;
