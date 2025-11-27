const schemaIngestionService = require('./schemaIngestionService');
const vectorStoreService = require('./vectorStoreService');
const geminiService = require('./geminiService');
const connectionService = require('./connectionService');
const logger = require('../utils/logger');

class RAGService {
    async syncSchema(connectionId) {
        const connection = await connectionService.getConnectionById(connectionId);
        if (!connection) throw new Error('Connection not found');

        try {
            // 1. Fetch Schema
            const schemaItems = await schemaIngestionService.fetchSchema(connection);

            // 2. Generate Embeddings & Store
            const itemsWithEmbeddings = await Promise.all(schemaItems.map(async item => {
                let embedding;
                if (connection.type === 'mock') {
                    // Generate random embedding for mock DB (768 dimensions)
                    embedding = Array(768).fill(0).map(() => Math.random());
                } else {
                    embedding = await geminiService.getEmbeddings(item.description);
                }
                return { ...item, embedding };
            }));

            await vectorStoreService.saveEmbeddings(connectionId, itemsWithEmbeddings);

            // Update connection sync status
            connection.schemaSyncedAt = new Date();
            await connection.save();

            return { success: true, count: schemaItems.length };
        } catch (error) {
            logger.error(`Sync Schema Error: ${error.message}`);
            throw error;
        }
    }

    async getSchema(connectionId) {
        // Ensure vector store is loaded
        await vectorStoreService.loading;

        // Get all schema items for this connection
        const schemaItems = vectorStoreService.store.filter(
            item => item.connectionId === connectionId
        );

        // Return simplified schema structure (tableName and description)
        return schemaItems.map(item => ({
            tableName: item.tableName,
            description: item.description
        }));
    }

    async generateSQL(question, connectionId, conversationHistory = []) {
        const connection = await connectionService.getConnectionById(connectionId);

        // Mock DB Logic - simple keyword matching for testing
        if (connection && connection.type === 'mock') {
            let sql = "SELECT 'I cannot answer this' as error";
            let relevantTables = [];

            const lowerQ = question.toLowerCase();
            if (lowerQ.includes('user')) {
                sql = "SELECT * FROM users";
                relevantTables = ['users'];
            } else if (lowerQ.includes('order')) {
                sql = "SELECT * FROM orders";
                relevantTables = ['orders'];
            } else if (lowerQ.includes('product')) {
                sql = "SELECT * FROM products";
                relevantTables = ['products'];
            }

            return { sql, relevantTables };
        }

        // Real DB Logic - RAG with Gemini
        // 1. Get relevant tables (RAG)
        const queryEmbedding = await geminiService.getEmbeddings(question);
        const relevantItems = await vectorStoreService.search(queryEmbedding, connectionId, 5);

        const relevantTables = relevantItems.map(item => ({
            tableName: item.tableName,
            description: item.description
        }));

        const context = relevantTables.map(t => t.description).join('\n');

        // 2. Build conversation context string
        let conversationContext = '';
        if (conversationHistory.length > 0) {
            conversationContext = '\nPrevious conversation:\n';
            conversationHistory.forEach((msg, idx) => {
                conversationContext += `Q${idx + 1}: ${msg.question}\nSQL${idx + 1}: ${msg.sql}\n\n`;
            });
        }

        // 3. Construct Prompt with conversation context
        const prompt = `
      You are an expert SQL generator.
      Convert the following natural language question into a valid SQL query.
      
      Target Database: Standard SQL (Postgres/MySQL/Oracle)
      
      Relevant Schema:
      ${context}
      ${conversationContext}
      Current Question: ${question}
      
      Rules:
      1. Return ONLY the SQL query. No markdown, no explanations.
      2. Do not use markdown code blocks.
      3. If the current question refers to previous queries (e.g., "filter that", "show more", "order by"), build upon the previous SQL.
      4. If you cannot answer, return "SELECT 'I cannot answer this' as error".
    `;

        // 4. Generate SQL
        const sql = await geminiService.generateSQL(prompt);
        return { sql, relevantTables: relevantTables.map(t => t.tableName) };
    }
}

module.exports = new RAGService();
