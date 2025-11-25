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
            return {
                insights: [
                    "Mock Insight 1: The data shows a positive trend in user growth.",
                    "Mock Insight 2: Significant spike observed in the last quarter."
                ],
                recommendedChartType: "bar",
                suggestedQuestions: [
                    "What is the total count?",
                    "Show top 5 by value",
                    "How does this compare to last month?",
                    "What are the trends over time?",
                    "Show detailed breakdown by category"
                ]
            };
        }
        try {
            // Limit results to avoid token overflow
            const sampleData = JSON.stringify(results.slice(0, 20));
            const prompt = `
            User Question: "${question}"
            Data Results (first 20 rows): ${sampleData}
            
            Analyze the data and the user's question. Return a JSON object with the following structure:
            {
                "insights": ["Insight 1", "Insight 2"],
                "recommendedChartType": "bar" | "pie" | "line" | "none",
                "suggestedQuestions": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
            }

            Rules:
            1. "insights": Provide exactly 2 actionable insights derived from the data. If the data does not require any insight or is too simple, return ["Insights not required"].
            2. "recommendedChartType": Recommend the best chart type ("bar", "pie", "line") to visualize this data.
               - If the user explicitly asks for a specific chart type in their question (e.g., "as a pie chart"), YOU MUST return that type.
               - If no visualization is appropriate, return "none".
            3. "suggestedQuestions": Provide exactly 5 relevant follow-up questions that the user might want to ask based on the current data and context. Make them specific and actionable.
            4. Return ONLY the JSON object, no markdown formatting.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            // Clean up potential markdown code blocks
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : text;

            return JSON.parse(jsonStr);
        } catch (error) {
            logger.error(`Gemini Insight Error: ${error.message}`);
            return {
                insights: ["Could not generate insights due to an error."],
                recommendedChartType: "bar",
                suggestedQuestions: []
            };
        }
    }
}

module.exports = new GeminiService();
