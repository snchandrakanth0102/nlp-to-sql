const logger = require('../utils/logger');
const connectionService = require('./connectionService');

// Configuration for pre-guardrails
const CONFIG = {
    MAX_QUESTION_LENGTH: 500,
    MIN_QUESTION_LENGTH: 3,
    MAX_REQUESTS_PER_MINUTE: 30, // Optional rate limiting
};

// Prompt injection patterns to detect
const INJECTION_PATTERNS = [
    /ignore\s+(previous|all|above)\s+instructions?/i,
    /you\s+are\s+now/i,
    /forget\s+(everything|all|previous)/i,
    /new\s+instructions?:/i,
    /system\s*:\s*/i,
    /\[SYSTEM\]/i,
    /\<\|im_start\|\>/i,
    /\<\|im_end\|\>/i,
    /disregard\s+(previous|all)/i,
    /override\s+instructions?/i,
];

// SQL injection keywords in natural language context
const SQL_INJECTION_PATTERNS = [
    /;\s*(drop|delete|truncate|alter)\s+/i,
    /union\s+select/i,
    /exec\s*\(/i,
    /execute\s*\(/i,
    /--\s*$/,
    /\/\*.*\*\//,
    /xp_cmdshell/i,
];

// Basic profanity/toxicity filter (extend as needed)
const PROFANITY_PATTERNS = [
    /\b(fuck|shit|damn|bitch|asshole)\b/i,
    // Add more as needed
];

class PreGuardrailService {
    constructor() {
        this.requestCounts = new Map(); // For rate limiting (in-memory, use Redis in production)
    }

    /**
     * Validate user input before sending to LLM
     * @param {string} question - User's natural language question
     * @param {string} connectionId - Connection ID to validate
     * @returns {Promise<{passed: boolean, violations: string[], sanitizedInput: string}>}
     */
    async validate(question, connectionId) {
        const violations = [];
        let sanitizedInput = question;

        // 1. Check if question is provided
        if (!question || typeof question !== 'string') {
            violations.push('Question is required and must be a string');
            return { passed: false, violations, sanitizedInput: '' };
        }

        // Trim whitespace
        sanitizedInput = sanitizedInput.trim();

        // 2. Length validation
        if (sanitizedInput.length < CONFIG.MIN_QUESTION_LENGTH) {
            violations.push(`Question is too short (minimum ${CONFIG.MIN_QUESTION_LENGTH} characters)`);
        }

        if (sanitizedInput.length > CONFIG.MAX_QUESTION_LENGTH) {
            violations.push(`Question is too long (maximum ${CONFIG.MAX_QUESTION_LENGTH} characters)`);
        }

        // 3. Prompt injection detection
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(sanitizedInput)) {
                violations.push('Potential prompt injection detected');
                logger.warn(`Prompt injection attempt detected: ${sanitizedInput.substring(0, 100)}`);
                break; // Only report once
            }
        }

        // 4. SQL injection pattern detection
        for (const pattern of SQL_INJECTION_PATTERNS) {
            if (pattern.test(sanitizedInput)) {
                violations.push('Potential SQL injection pattern detected in question');
                logger.warn(`SQL injection pattern detected: ${sanitizedInput.substring(0, 100)}`);
                break;
            }
        }

        // 5. Profanity/toxicity filter
        for (const pattern of PROFANITY_PATTERNS) {
            if (pattern.test(sanitizedInput)) {
                violations.push('Inappropriate language detected');
                break;
            }
        }

        // 6. Connection validation
        if (connectionId) {
            try {
                const connection = await connectionService.getConnectionById(connectionId);
                if (!connection) {
                    violations.push('Invalid connection ID');
                }
            } catch (error) {
                violations.push('Failed to validate connection');
                logger.error(`Connection validation error: ${error.message}`);
            }
        } else {
            violations.push('Connection ID is required');
        }

        // 7. Rate limiting (optional, basic implementation)
        // In production, use Redis or similar for distributed rate limiting
        const rateLimitViolation = this._checkRateLimit(connectionId);
        if (rateLimitViolation) {
            violations.push(rateLimitViolation);
        }

        // Determine if validation passed
        const passed = violations.length === 0;

        if (!passed) {
            logger.warn(`Pre-guardrail validation failed: ${violations.join(', ')}`);
        }

        return {
            passed,
            violations,
            sanitizedInput: passed ? sanitizedInput : ''
        };
    }

    /**
     * Basic rate limiting check (in-memory)
     * @param {string} identifier - User/connection identifier
     * @returns {string|null} Violation message or null
     */
    _checkRateLimit(identifier) {
        if (!identifier) return null;

        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute

        if (!this.requestCounts.has(identifier)) {
            this.requestCounts.set(identifier, []);
        }

        const requests = this.requestCounts.get(identifier);

        // Remove old requests outside the time window
        const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);

        if (recentRequests.length >= CONFIG.MAX_REQUESTS_PER_MINUTE) {
            return `Rate limit exceeded (max ${CONFIG.MAX_REQUESTS_PER_MINUTE} requests per minute)`;
        }

        // Add current request
        recentRequests.push(now);
        this.requestCounts.set(identifier, recentRequests);

        return null;
    }

    /**
     * Clear rate limit data (for testing or cleanup)
     */
    clearRateLimits() {
        this.requestCounts.clear();
    }
}

module.exports = new PreGuardrailService();
