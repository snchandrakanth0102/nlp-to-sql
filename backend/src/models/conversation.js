const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    connectionId: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'New Conversation',
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

const ConversationMessage = sequelize.define('ConversationMessage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Conversations',
            key: 'id',
        },
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    sql: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

// Define relationship
Conversation.hasMany(ConversationMessage, { foreignKey: 'conversationId' });
ConversationMessage.belongsTo(Conversation, { foreignKey: 'conversationId' });

module.exports = { Conversation, ConversationMessage };

