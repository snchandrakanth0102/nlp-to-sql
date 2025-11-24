const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Path to metadata configuration file
const METADATA_PATH = path.join(__dirname, '../config/metadata.json');

class MetadataService {
    constructor() {
        this.metadata = null;
        this._loadMetadata();
    }

    _loadMetadata() {
        try {
            if (fs.existsSync(METADATA_PATH)) {
                const rawData = fs.readFileSync(METADATA_PATH, 'utf8');
                this.metadata = JSON.parse(rawData);
                logger.info(`Loaded metadata for ${Object.keys(this.metadata.connections).length} schemas`);
            } else {
                logger.warn('Metadata file not found. Creating empty metadata structure.');
                this.metadata = { connections: {} };
            }
        } catch (error) {
            logger.error(`Failed to load metadata: ${error.message}`);
            this.metadata = { connections: {} };
        }
    }

    /**
     * Get all available metadata connection IDs
     * @returns {string[]} Array of metadata connection IDs
     */
    getAvailableSchemas() {
        return Object.keys(this.metadata.connections);
    }

    /**
     * Get metadata for a specific schema
     * @param {string} metadataId - The metadata schema ID (e.g., 'ecommerce', 'hr')
     * @returns {object|null} Schema metadata or null if not found
     */
    getSchema(metadataId) {
        if (!this.metadata.connections[metadataId]) {
            logger.warn(`Metadata schema '${metadataId}' not found`);
            return null;
        }
        return this.metadata.connections[metadataId];
    }

    /**
     * Get table definitions in the format expected by schemaIngestionService
     * @param {string} metadataId - The metadata schema ID
     * @returns {Array} Array of table definitions with tableName, columns, description
     */
    getTableDefinitions(metadataId) {
        const schema = this.getSchema(metadataId);
        if (!schema) {
            return [];
        }

        return schema.tables.map(table => {
            // Format columns as "name (type)" for consistency with database fetchers
            const columnStrings = table.columns.map(col => {
                const description = col.description ? ` - ${col.description}` : '';
                return `${col.name} (${col.type})${description}`;
            });

            return {
                tableName: table.tableName,
                columns: columnStrings,
                description: `Table ${table.tableName}: ${table.description}. Columns: ${columnStrings.join(', ')}`
            };
        });
    }

    /**
     * Validate if a metadata schema exists
     * @param {string} metadataId - The metadata schema ID to validate
     * @returns {boolean} True if schema exists
     */
    schemaExists(metadataId) {
        return this.metadata.connections.hasOwnProperty(metadataId);
    }

    /**
     * Get schema info (name and description)
     * @param {string} metadataId - The metadata schema ID
     * @returns {object|null} Schema info or null
     */
    getSchemaInfo(metadataId) {
        const schema = this.getSchema(metadataId);
        if (!schema) {
            return null;
        }
        return {
            name: schema.name,
            description: schema.description,
            tableCount: schema.tables.length
        };
    }

    /**
     * Reload metadata from file (useful for hot-reloading)
     */
    reload() {
        logger.info('Reloading metadata from file...');
        this._loadMetadata();
    }
}

module.exports = new MetadataService();
