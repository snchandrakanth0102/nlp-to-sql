const { Pool: PgPool } = require('pg');
const oracledb = require('oracledb');
const mysql = require('mysql2/promise');
const connectionService = require('./connectionService');
const logger = require('../utils/logger');

class QueryExecutorService {
    constructor() {
        // Connection pools cache
        this.pools = new Map();
    }

    _getPoolKey(connectionId) {
        return `pool_${connectionId}`;
    }

    async _getOrCreatePool(connection) {
        const poolKey = this._getPoolKey(connection.id);

        if (this.pools.has(poolKey)) {
            return this.pools.get(poolKey);
        }

        const { type, host, port, database, username, password } = connection;
        let pool;

        if (type === 'postgres') {
            pool = new PgPool({
                host,
                port,
                database,
                user: username,
                password,
                max: 10, // Maximum pool size
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            });
        } else if (type === 'mysql') {
            pool = mysql.createPool({
                host,
                port,
                user: username,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                connectTimeout: 5000,
            });
        }

        if (pool) {
            this.pools.set(poolKey, pool);
            logger.info(`Created connection pool for ${type} connection ${connection.id}`);
        }

        return pool;
    }

    async executeQuery(connectionId, sql) {
        const connection = await connectionService.getConnectionById(connectionId);
        if (!connection) throw new Error('Connection not found');

        const { type } = connection;

        // Safety check
        if (/drop|delete|insert|update|alter|truncate/i.test(sql)) {
            throw new Error('Safety Error: Only SELECT queries are allowed.');
        }

        try {
            if (type === 'postgres') {
                const pool = await this._getOrCreatePool(connection);
                const result = await pool.query(sql);
                return result.rows;
            } else if (type === 'oracle') {
                return [];
            } else if (type === 'mysql') {
                const pool = await this._getOrCreatePool(connection);
                const [rows] = await pool.execute(sql);
                return rows;
            } else if (type === 'mock') {
                // Return fake data based on table names in SQL
                if (sql.includes('users')) {
                    return [
                        { id: 1, name: 'Alice', email: 'alice@example.com', signup_date: '2023-01-01' },
                        { id: 2, name: 'Bob', email: 'bob@example.com', signup_date: '2023-01-02' },
                        { id: 3, name: 'Charlie', email: 'charlie@example.com', signup_date: '2023-01-03' },
                    ];
                } else if (sql.includes('orders')) {
                    return [
                        { id: 101, user_id: 1, amount: 99.99, status: 'completed' },
                        { id: 102, user_id: 2, amount: 49.50, status: 'pending' },
                        { id: 103, user_id: 1, amount: 150.00, status: 'completed' },
                    ];
                }
                return [];
            }
        } catch (error) {
            logger.error(`Query Execution Error: ${error.message}`);
            throw error;
        }
    }

    // Cleanup method to close all pools
    async closeAllPools() {
        for (const [key, pool] of this.pools.entries()) {
            try {
                if (pool.end) {
                    await pool.end();
                }
                logger.info(`Closed connection pool: ${key}`);
            } catch (err) {
                logger.error(`Error closing pool ${key}: ${err.message}`);
            }
        }
        this.pools.clear();
    }
}

module.exports = new QueryExecutorService();
