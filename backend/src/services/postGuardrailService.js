const logger = require('../utils/logger');

// Configuration for post-guardrails
const CONFIG = {
    MAX_JOINS: 5,
    MAX_SUBQUERIES: 3,
    ALLOW_DESTRUCTIVE_OPS: false, // Set to true to allow UPDATE, DELETE, etc.
    MIN_CONFIDENCE_SCORE: 30, // Minimum confidence score to pass (0-100)
};

// Destructive SQL operations
const DESTRUCTIVE_KEYWORDS = [
    'DROP',
    'DELETE',
    'TRUNCATE',
    'ALTER',
    'UPDATE',
    'EXEC',
    'EXECUTE',
    'INSERT',
    'CREATE',
    'GRANT',
    'REVOKE',
];

// System/sensitive tables to block
const SYSTEM_TABLE_PATTERNS = [
    /information_schema\./i,
    /pg_catalog\./i,
    /sys\./i,
    /mysql\./i,
    /performance_schema\./i,
    /pg_/i,
    /\buser\b.*\bpassword/i,
    /\bcredential/i,
];

// Sensitive column patterns
const SENSITIVE_COLUMN_PATTERNS = [
    /password/i,
    /passwd/i,
    /pwd/i,
    /secret/i,
    /token/i,
    /api_key/i,
    /private_key/i,
    /ssn/i,
    /credit_card/i,
];

class PostGuardrailService {
    /**
     * Validate generated SQL before returning to user
     * @param {string} sql - Generated SQL query
     * @param {string[]} relevantTables - List of relevant table names from RAG
     * @returns {Promise<{passed: boolean, violations: string[], sanitizedSQL: string, confidenceScore: number, warnings: string[]}>}
     */
    async validate(sql, relevantTables = []) {
        const violations = [];
        const warnings = [];
        let sanitizedSQL = sql;
        let confidenceScore = 100;

        // 1. Check if SQL is provided
        if (!sql || typeof sql !== 'string') {
            violations.push('Generated SQL is empty or invalid');
            return { passed: false, violations, sanitizedSQL: '', confidenceScore: 0, warnings };
        }

        sanitizedSQL = sanitizedSQL.trim();

        // 2. Basic SQL syntax validation
        if (!this._isValidSQLSyntax(sanitizedSQL)) {
            violations.push('Generated SQL has invalid syntax');
            confidenceScore -= 30;
        }

        // 3. Detect multiple statements (SQL injection prevention)
        if (this._hasMultipleStatements(sanitizedSQL)) {
            violations.push('Multiple SQL statements detected (only single queries allowed)');
        }

        // 4. Destructive operation detection
        if (!CONFIG.ALLOW_DESTRUCTIVE_OPS) {
            const destructiveOp = this._detectDestructiveOperations(sanitizedSQL);
            if (destructiveOp) {
                violations.push(`Destructive operation detected: ${destructiveOp}`);
            }
        }

        // 5. System table access prevention
        const systemTableViolation = this._detectSystemTableAccess(sanitizedSQL);
        if (systemTableViolation) {
            violations.push(systemTableViolation);
        }

        // 6. Sensitive column detection
        const sensitiveColumn = this._detectSensitiveColumns(sanitizedSQL);
        if (sensitiveColumn) {
            warnings.push(`Query accesses potentially sensitive column: ${sensitiveColumn}`);
            confidenceScore -= 10;
        }

        // 7. Query complexity limits
        const complexityViolations = this._checkQueryComplexity(sanitizedSQL);
        if (complexityViolations.length > 0) {
            warnings.push(...complexityViolations);
            confidenceScore -= 5 * complexityViolations.length;
        }

        // 8. Hallucination detection - verify tables exist in relevant tables
        if (relevantTables && relevantTables.length > 0) {
            const hallucinationCheck = this._detectHallucinations(sanitizedSQL, relevantTables);
            if (hallucinationCheck.hasHallucinations) {
                warnings.push(`Query references tables not in context: ${hallucinationCheck.unknownTables.join(', ')}`);
                confidenceScore -= 20;
            }
        }

        // 9. Check for common SQL anti-patterns
        const antiPatterns = this._detectAntiPatterns(sanitizedSQL);
        if (antiPatterns.length > 0) {
            warnings.push(...antiPatterns);
            confidenceScore -= 5 * antiPatterns.length;
        }

        // Ensure confidence score is within bounds
        confidenceScore = Math.max(0, Math.min(100, confidenceScore));

        // Check if confidence score meets minimum threshold
        if (confidenceScore < CONFIG.MIN_CONFIDENCE_SCORE) {
            violations.push(`Confidence score too low: ${confidenceScore}% (minimum ${CONFIG.MIN_CONFIDENCE_SCORE}%)`);
        }

        // Determine if validation passed
        const passed = violations.length === 0;

        if (!passed) {
            logger.warn(`Post-guardrail validation failed: ${violations.join(', ')}`);
        }

        if (warnings.length > 0) {
            logger.info(`Post-guardrail warnings: ${warnings.join(', ')}`);
        }

        return {
            passed,
            violations,
            sanitizedSQL: passed ? sanitizedSQL : sql,
            confidenceScore,
            warnings
        };
    }

    /**
     * Basic SQL syntax validation
     */
    _isValidSQLSyntax(sql) {
        // Must start with SELECT, WITH, or other valid SQL keywords
        const validStarters = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)/i;
        return validStarters.test(sql);
    }

    /**
     * Detect multiple SQL statements
     */
    _hasMultipleStatements(sql) {
        // Check for semicolons not in strings
        const semicolons = sql.match(/;/g);
        if (!semicolons) return false;

        // Allow one semicolon at the end
        const trimmed = sql.trim();
        if (trimmed.endsWith(';') && semicolons.length === 1) {
            return false;
        }

        return semicolons.length > 1;
    }

    /**
     * Detect destructive operations
     */
    _detectDestructiveOperations(sql) {
        const upperSQL = sql.toUpperCase();
        for (const keyword of DESTRUCTIVE_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(sql)) {
                return keyword;
            }
        }
        return null;
    }

    /**
     * Detect system table access
     */
    _detectSystemTableAccess(sql) {
        for (const pattern of SYSTEM_TABLE_PATTERNS) {
            if (pattern.test(sql)) {
                return 'System table access detected';
            }
        }
        return null;
    }

    /**
     * Detect sensitive columns
     */
    _detectSensitiveColumns(sql) {
        for (const pattern of SENSITIVE_COLUMN_PATTERNS) {
            if (pattern.test(sql)) {
                const match = sql.match(pattern);
                return match ? match[0] : 'sensitive column';
            }
        }
        return null;
    }

    /**
     * Check query complexity
     */
    _checkQueryComplexity(sql) {
        const violations = [];

        // Count JOINs
        const joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
        if (joinCount > CONFIG.MAX_JOINS) {
            violations.push(`Too many JOINs: ${joinCount} (max ${CONFIG.MAX_JOINS})`);
        }

        // Count subqueries
        const subqueryCount = (sql.match(/\(\s*SELECT\b/gi) || []).length;
        if (subqueryCount > CONFIG.MAX_SUBQUERIES) {
            violations.push(`Too many subqueries: ${subqueryCount} (max ${CONFIG.MAX_SUBQUERIES})`);
        }

        return violations;
    }

    /**
     * Detect hallucinations - tables not in relevant context
     */
    _detectHallucinations(sql, relevantTables) {
        // Extract table names from SQL (basic extraction)
        const tablePattern = /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)|JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
        const matches = [...sql.matchAll(tablePattern)];

        const tablesInSQL = new Set();
        matches.forEach(match => {
            const tableName = match[1] || match[2];
            if (tableName) {
                tablesInSQL.add(tableName.toLowerCase());
            }
        });

        const relevantTableSet = new Set(relevantTables.map(t => t.toLowerCase()));
        const unknownTables = [...tablesInSQL].filter(t => !relevantTableSet.has(t));

        return {
            hasHallucinations: unknownTables.length > 0,
            unknownTables
        };
    }

    /**
     * Detect common SQL anti-patterns
     */
    _detectAntiPatterns(sql) {
        const antiPatterns = [];

        // SELECT * without LIMIT
        if (/SELECT\s+\*/i.test(sql) && !/LIMIT\s+\d+/i.test(sql)) {
            antiPatterns.push('SELECT * without LIMIT may return too many rows');
        }

        // Missing WHERE clause on potentially large tables
        if (/FROM\s+\w+/i.test(sql) && !/WHERE/i.test(sql) && !/LIMIT/i.test(sql)) {
            antiPatterns.push('Query without WHERE or LIMIT clause may be inefficient');
        }

        return antiPatterns;
    }
}

module.exports = new PostGuardrailService();
