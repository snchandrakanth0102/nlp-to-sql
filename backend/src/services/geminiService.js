const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        this.apiKey = apiKey;
        if (!apiKey || apiKey === 'dummy_key_change_me') {
            logger.warn('GEMINI_API_KEY is not set. AI features will fail or use mocks.');
        }
        if (apiKey && apiKey !== 'dummy_key_change_me') {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
        }
    }

    async generateSQL(prompt) {
        if (this.apiKey === 'dummy_key_change_me' || !this.apiKey) {
            return "SELECT * FROM customers LIMIT 10; -- Mock SQL because API key is missing";
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Basic cleanup to extract SQL from markdown blocks if present
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
            return sqlMatch ? sqlMatch[1].trim() : text.trim();
        } catch (error) {
            logger.error(`Gemini Generation Error: ${error.message}. Falling back to mock SQL.`);
            return "SELECT * FROM customers LIMIT 10; -- Mock SQL because API key is invalid or quota exceeded";
        }
    }

    async getEmbeddings(text) {
        if (this.apiKey === 'dummy_key_change_me' || !this.apiKey) {
            logger.warn('Using mock embeddings because GEMINI_API_KEY is not set.');
            return Array(768).fill(0).map(() => Math.random());
        }
        try {
            const result = await this.embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            logger.error(`Gemini Embedding Error: ${error.message}. Falling back to mock embeddings.`);
            return Array(768).fill(0).map(() => Math.random());
        }
    }

    async generateInsights(question, results) {
        if (this.apiKey === 'dummy_key_change_me' || !this.apiKey) {
            return "Mock Insight: The data shows a positive trend in user growth over the last quarter, with a significant spike in March.";
        }
        try {
            // Limit results to avoid token overflow
            const sampleData = JSON.stringify(results.slice(0, 20));
            const prompt = `
            User Question: "${question}"
            Data Results (first 20 rows): ${sampleData}
            
            Based on the user's question and the provided data, generate a concise, 2-line insight or summary. Focus on the key finding.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            logger.error(`Gemini Insight Error: ${error.message}`);
            return "Could not generate insights due to an error.";
        }
    }
}

module.exports = new GeminiService();
