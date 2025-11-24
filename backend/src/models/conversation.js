const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    connectionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'conversations',
    timestamps: true
});

const ConversationMessage = sequelize.define('ConversationMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    conversationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'conversations',
            key: 'id'
        }
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    sql: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'conversation_messages',
    timestamps: false
});

// Define associations
Conversation.hasMany(ConversationMessage, { foreignKey: 'conversationId', as: 'messages' });
ConversationMessage.belongsTo(Conversation, { foreignKey: 'conversationId' });

module.exports = { Conversation, ConversationMessage };
