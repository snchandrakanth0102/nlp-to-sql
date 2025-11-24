const connectionService = require('../services/connectionService');

class ConnectionController {
    async create(req, res) {
        try {
            const connection = await connectionService.createConnection(req.body);
            res.status(201).json(connection);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async list(req, res) {
        try {
            const connections = await connectionService.getAllConnections();
            res.json(connections);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async test(req, res) {
        try {
            // Can test an existing connection (by ID) or a new one (by body)
            const result = await connectionService.testConnection(req.body);
            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            const success = await connectionService.deleteConnection(req.params.id);
            if (success) {
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Connection not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ConnectionController();
