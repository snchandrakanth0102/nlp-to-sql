const { Client } = require('pg');
const oracledb = require('oracledb');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const metadataService = require('./metadataService');

class SchemaIngestionService {
    async fetchSchema(connection) {
        const { type, host, port, database, username, password } = connection;

        if (type === 'postgres') {
            return await this._fetchPostgresSchema(host, port, database, username, password);
        } else if (type === 'oracle') {
            return await this._fetchOracleSchema(host, port, database, username, password);
        } else if (type === 'mysql') {
            return await this._fetchMySQLSchema(host, port, database, username, password);
        } else if (type === 'metadata') {
            // For metadata type, use the database field as the metadata schema ID
            return await this._fetchMetadataSchema(database || 'ecommerce');
        } else if (type === 'mock') {
            return [
                { tableName: 'users', description: 'Table users with columns: id (int), name (text), email (text), signup_date (date)', columns: ['id', 'name', 'email', 'signup_date'] },
                { tableName: 'orders', description: 'Table orders with columns: id (int), user_id (int), amount (decimal), status (text)', columns: ['id', 'user_id', 'amount', 'status'] },
                { tableName: 'products', description: 'Table products with columns: id (int), name (text), price (decimal), stock (int)', columns: ['id', 'name', 'price', 'stock'] }
            ];
        }
        throw new Error('Unsupported DB type');
    }

    async _fetchMetadataSchema(metadataId) {
        logger.info(`Fetching metadata schema: ${metadataId}`);
        const tableDefinitions = metadataService.getTableDefinitions(metadataId);

        if (tableDefinitions.length === 0) {
            throw new Error(`Metadata schema '${metadataId}' not found or has no tables`);
        }

        logger.info(`Loaded ${tableDefinitions.length} tables from metadata schema '${metadataId}'`);
        return tableDefinitions;
    }

    async _fetchPostgresSchema(host, port, database, user, password) {
        const client = new Client({ host, port, database, user, password });
        try {
            await client.connect();
            const query = `
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `;
            const res = await client.query(query);

            const schema = {};
            res.rows.forEach(row => {
                if (!schema[row.table_name]) {
                    schema[row.table_name] = [];
                }
                schema[row.table_name].push(`${row.column_name} (${row.data_type})`);
            });

            return Object.keys(schema).map(tableName => ({
                tableName,
                columns: schema[tableName],
                description: `Table ${tableName} with columns: ${schema[tableName].join(', ')}`
            }));

        } catch (error) {
            logger.error(`Postgres Schema Fetch Error: ${error.message}`);
            throw error;
        } finally {
            await client.end();
        }
    }

    async _fetchOracleSchema(host, port, database, user, password) {
        return [];
    }

    async _fetchMySQLSchema(host, port, database, user, password) {
        try {
            const connection = await mysql.createConnection({
                host, port, user, password, database
            });

            const [rows] = await connection.execute(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = ?
                ORDER BY table_name, ordinal_position
            `, [database]);

            await connection.end();

            const schema = {};
            rows.forEach(row => {
                if (!schema[row.TABLE_NAME]) {
                    schema[row.TABLE_NAME] = [];
                }
                schema[row.TABLE_NAME].push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
            });

            return Object.keys(schema).map(tableName => ({
                tableName,
                columns: schema[tableName],
                description: `Table ${tableName} with columns: ${schema[tableName].join(', ')}`
            }));

        } catch (error) {
            logger.error(`MySQL Schema Fetch Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new SchemaIngestionService();
