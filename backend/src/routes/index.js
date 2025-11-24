const express = require('express');
const router = express.Router();
const connectionRoutes = require('./connectionRoutes');
const queryRoutes = require('./queryRoutes');

router.use('/connections', connectionRoutes);
router.use('/query', queryRoutes);

router.get('/', (req, res) => {
    res.json({ message: 'NLP-to-SQL API v1' });
});

module.exports = router;
