const ragService = require('../services/ragService');
const queryExecutorService = require('../services/queryExecutorService');
const preGuardrailService = require('../services/preGuardrailService');
const postGuardrailService = require('../services/postGuardrailService');
const connectionService = require('../services/connectionService');
const geminiService = require('../services/geminiService');
const conversationService = require('../services/conversationService');
const { QueryHistory } = require('../models');

class QueryController {
    async syncSchema(req, res) {
        try {
            const { id } = req.params;
            const result = await ragService.syncSchema(id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async ask(req, res) {
        try {
            const { connectionId, question, conversationId } = req.body;

            // 1. PRE-GUARDRAIL: Validate user input
            const preValidation = await preGuardrailService.validate(question, connectionId);
            if (!preValidation.passed) {
                return res.status(400).json({
                    error: 'Input validation failed',
                    violations: preValidation.violations
                });
            }

            // 1.5. Get or create conversation and fetch history
            let currentConversationId = conversationId;
            if (!currentConversationId) {
                const newConversation = await conversationService.createConversation(connectionId);
                currentConversationId = newConversation.id;
            }

            const conversationHistory = await conversationService.getHistory(currentConversationId, 5);

            // 2. Generate SQL using sanitized input + conversation context
            const { sql, relevantTables } = await ragService.generateSQL(
                preValidation.sanitizedInput,
                connectionId,
                conversationHistory
            );

            // 3. POST-GUARDRAIL: Validate generated SQL
            const postValidation = await postGuardrailService.validate(sql, relevantTables);
            if (!postValidation.passed) {
                return res.status(400).json({
                    error: 'Generated SQL failed safety checks',
                    violations: postValidation.violations,
                    sql: sql,
                    confidenceScore: postValidation.confidenceScore,
                    warnings: postValidation.warnings
                });
            }

            // 4. Check if connection is metadata-only
            const connection = await connectionService.getConnectionById(connectionId);
            const isMetadataOnly = connection && connection.type === 'metadata';

            // 5. Execute SQL (skip for metadata-only connections)
            let results = [];
            let error = null;
            let executionTimeMs = 0;

            if (isMetadataOnly) {
                // Metadata-only mode: don't execute, just return SQL
                results = null;
            } else {
                // Execute against real database
                const startTime = Date.now();
                try {
                    results = await queryExecutorService.executeQuery(connectionId, postValidation.sanitizedSQL);
                    executionTimeMs = Date.now() - startTime;
                } catch (e) {
                    error = e.message;
                    executionTimeMs = Date.now() - startTime;
                }
            }

            // 6. Log History
            await QueryHistory.create({
                question: preValidation.sanitizedInput,
                generatedSql: postValidation.sanitizedSQL,
                status: error ? 'error' : 'success',
                errorMessage: error,
                executionTimeMs
            });

            // 7. Return response
            const response = {
                sql: postValidation.sanitizedSQL,
                relevantTables,
                confidenceScore: postValidation.confidenceScore,
                warnings: postValidation.warnings
            };

            if (isMetadataOnly) {
                response.metadataOnly = true;
                response.message = 'Query generated successfully (metadata-only mode, not executed)';
            } else if (error) {
                response.error = error;
                return res.status(400).json(response);
            } else {
                response.results = results;
                response.executionTimeMs = executionTimeMs;

                // Generate Insights
                if (results && results.length > 0) {
                    const insightsData = await geminiService.generateInsights(preValidation.sanitizedInput, results);
                    response.insights = insightsData.insights;
                    response.recommendedChartType = insightsData.recommendedChartType;
                    response.suggestedQuestions = insightsData.suggestedQuestions || [];
                }
            }

            // 8. Save to conversation history
            await conversationService.addMessage(currentConversationId, preValidation.sanitizedInput, postValidation.sanitizedSQL);

            // 9. Add conversationId to response
            response.conversationId = currentConversationId;

            res.json(response);

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new QueryController();
