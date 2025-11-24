const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Connection = sequelize.define('Connection', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'postgres'
    },
    host: {
        type: DataTypes.STRING,
        allowNull: true, // Optional for metadata type
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: true, // Optional for metadata type
    },
    database: {
        type: DataTypes.STRING,
        allowNull: true, // Optional for metadata type (used as schema ID for metadata)
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true, // Optional for metadata type
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true, // Optional for metadata type
    },
    // Store schema embeddings/metadata status
    schemaSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
});

module.exports = Connection;
