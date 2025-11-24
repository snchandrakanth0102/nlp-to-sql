const sequelize = require('../config/database');
const Connection = require('./connection');
const QueryHistory = require('./queryHistory');
const { Conversation, ConversationMessage } = require('./conversation');

async function initDB() {
    await sequelize.sync();
}

module.exports = {
    initDB,
    Connection,
    QueryHistory,
    Conversation,
    ConversationMessage
};
