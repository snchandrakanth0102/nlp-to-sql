const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Simple JSON file storage for embeddings
const STORE_PATH = path.join(__dirname, '../../vector_store.json');

class VectorStoreService {
    constructor() {
        this.store = [];
        this.loading = this._loadStore(); // Async init
    }

    async _loadStore() {
        try {
            // Check if file exists synchronously first (only for existence check)
            if (fsSync.existsSync(STORE_PATH)) {
                const data = await fs.readFile(STORE_PATH, 'utf8');
                this.store = JSON.parse(data);
                logger.info(`Loaded ${this.store.length} vectors from store`);
            }
        } catch (e) {
            logger.error('Failed to load vector store', e);
            this.store = [];
        }
    }

    async _saveStore() {
        try {
            await fs.writeFile(STORE_PATH, JSON.stringify(this.store, null, 2));
        } catch (e) {
            logger.error('Failed to save vector store', e);
            throw e;
        }
    }

    async saveEmbeddings(connectionId, schemaItems) {
        // Ensure store is loaded
        await this.loading;

        // Remove old embeddings for this connection
        this.store = this.store.filter(item => item.connectionId !== connectionId);

        // Add new items (schemaItem has { tableName, description, embedding })
        const newItems = schemaItems.map(item => ({
            connectionId,
            ...item
        }));

        this.store.push(...newItems);
        await this._saveStore();
        logger.info(`Saved ${newItems.length} embeddings for connection ${connectionId}`);
    }

    // Cosine similarity search
    async search(queryEmbedding, connectionId, topK = 5) {
        // Ensure store is loaded
        await this.loading;

        // Filter by connection
        const candidates = this.store.filter(item => item.connectionId === connectionId);

        if (candidates.length === 0) {
            logger.warn(`No vectors found for connection ${connectionId}`);
            return [];
        }

        // Calculate scores
        const scored = candidates.map(item => {
            const score = this._cosineSimilarity(queryEmbedding, item.embedding);
            return { ...item, score };
        });

        // Sort and slice
        return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    _cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magA * magB);
    }
}

module.exports = new VectorStoreService();
