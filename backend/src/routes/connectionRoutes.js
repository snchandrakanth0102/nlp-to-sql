const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connectionController');

router.post('/', connectionController.create);
router.get('/', connectionController.list);
router.post('/test', connectionController.test);
router.delete('/:id', connectionController.delete);

module.exports = router;
