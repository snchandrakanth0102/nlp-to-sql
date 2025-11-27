const { Conversation, ConversationMessage } = require('../models');
const logger = require('../utils/logger');

class ConversationService {
    async createConversation(connectionId) {
        try {
            const conversation = await Conversation.create({ connectionId });
            logger.info(`Created conversation ${conversation.id} for connection ${connectionId}`);
            return conversation;
        } catch (error) {
            logger.error(`Error creating conversation: ${error.message}`);
            throw error;
        }
    }

    async addMessage(conversationId, question, sql) {
        try {
            const message = await ConversationMessage.create({
                conversationId,
                question,
                sql
            });
            return message;
        } catch (error) {
            logger.error(`Error adding message: ${error.message}`);
            throw error;
        }
    }

    async getHistory(conversationId, limit = 5) {
        try {
            const messages = await ConversationMessage.findAll({
                where: { conversationId },
                order: [['createdAt', 'DESC']],
                limit
            });
            // Reverse to get chronological order
            return messages.reverse();
        } catch (error) {
            logger.error(`Error fetching history: ${error.message}`);
            return [];
        }
    }

    async getConversation(conversationId) {
        try {
            return await Conversation.findByPk(conversationId);
        } catch (error) {
            logger.error(`Error fetching conversation: ${error.message}`);
            return null;
        }
    }

    async getAllConversations(connectionId) {
        try {
            const conversations = await Conversation.findAll({
                where: { connectionId },
                order: [['createdAt', 'DESC']],
                include: [{
                    model: ConversationMessage,
                    limit: 1,
                    order: [['createdAt', 'ASC']]
                }]
            });
            return conversations;
        } catch (error) {
            logger.error(`Error fetching conversations: ${error.message}`);
            return [];
        }
    }

    async getConversationWithMessages(conversationId) {
        try {
            const messages = await ConversationMessage.findAll({
                where: { conversationId },
                order: [['createdAt', 'ASC']]
            });
            return messages;
        } catch (error) {
            logger.error(`Error fetching conversation messages: ${error.message}`);
            return [];
        }
    }

    async updateConversationTitle(conversationId, title) {
        try {
            await Conversation.update(
                { title },
                { where: { id: conversationId } }
            );
            logger.info(`Updated conversation ${conversationId} title to: ${title}`);
        } catch (error) {
            logger.error(`Error updating conversation title: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new ConversationService();
