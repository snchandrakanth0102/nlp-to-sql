const { Connection } = require('../models');
const { Client } = require('pg');
const oracledb = require('oracledb');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class ConnectionService {
    async createConnection(data) {
        return await Connection.create(data);
    }

    async getAllConnections() {
        return await Connection.findAll({
            attributes: { exclude: ['password'] }
        });
    }

    async getConnectionById(id) {
        return await Connection.findByPk(id);
    }

    async deleteConnection(id) {
        const connection = await Connection.findByPk(id);
        if (connection) {
            await connection.destroy();
            return true;
        }
        return false;
    }

    async testConnection(connectionData) {
        const { type, host, port, database, username, password } = connectionData;

        try {
            if (type === 'postgres') {
                const client = new Client({
                    host,
                    port,
                    database,
                    user: username,
                    password,
                    ssl: false
                });
                await client.connect();
                await client.end();
                return { success: true, message: 'Successfully connected to Postgres' };
            } else if (type === 'oracle') {
                const connection = await oracledb.getConnection({
                    user: username,
                    password: password,
                    connectString: `${host}:${port}/${database}`
                });
                await connection.close();
                return { success: true, message: 'Successfully connected to Oracle' };
            } else if (type === 'mock') {
                return { success: true, message: 'Successfully connected to Mock DB' };
            } else if (type === 'metadata') {
                // For metadata type, just validate that the schema exists
                const metadataService = require('./metadataService');
                const schemaId = database || 'ecommerce';
                if (metadataService.schemaExists(schemaId)) {
                    const schemaInfo = metadataService.getSchemaInfo(schemaId);
                    return {
                        success: true,
                        message: `Successfully loaded metadata schema: ${schemaInfo.name} (${schemaInfo.tableCount} tables)`
                    };
                } else {
                    return {
                        success: false,
                        message: `Metadata schema '${schemaId}' not found. Available: ${metadataService.getAvailableSchemas().join(', ')}`
                    };
                }
            } else if (type === 'mysql') {
                const connection = await mysql.createConnection({
                    host, port, user: username, password, database
                });
                await connection.end();
                return { success: true, message: 'Successfully connected to MySQL' };
            }
            return { success: false, message: 'Unsupported database type' };
        } catch (error) {
            logger.error(`Connection test failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

module.exports = new ConnectionService();
