const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QueryHistory = sequelize.define('QueryHistory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    generatedSql: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('success', 'error', 'pending'),
        defaultValue: 'pending',
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    executionTimeMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    conversationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Conversations', // Note: Sequelize pluralizes table names by default
            key: 'id',
        },
    },
});

module.exports = QueryHistory;
