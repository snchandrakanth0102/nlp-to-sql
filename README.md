# RAG-Enabled NLP-to-SQL Application
## Complete Architecture & Production Deployment Guide

This document provides a comprehensive overview of the entire application architecture, data flows, API endpoints, optimization techniques, and production deployment strategies.

Refer to [ARCHITECTURE.md](file:///C:/Users/admin/.gemini/antigravity/brain/a0bfce63-f366-428d-831c-bdcdf7754115/ARCHITECTURE.md) for the complete technical documentation.

## Quick Reference

### Key Features
1. **Multi-Database Support** - PostgreSQL, MySQL, Oracle, Mock DB
2. **RAG-Powered SQL Generation** - Context-aware query generation
3. **AI Insights** - Automatic data summaries
4. **Conversational Context** - Follow-up questions with memory
5. **Custom Visualizations** - Bar, Pie, Line charts
6. **Export Options** - CSV and PDF downloads
7. **Connection Pooling** - Optimized database performance
8. **Guardrails** - Two-layer security validation

### Main Application Flow
```
User Question → Pre-Guardrail → RAG (Vector Search) → SQL Generation → 
Post-Guardrail → Query Execution → Insights Generation → Response with Data
```

### Conversational Flow
```
Q1: "Show me customers" → Creates Conversation #42
Q2: "Filter by USA" → Uses Conversation #42 context → Generates filtered SQL
```

### Directory Structure
- `backend/src/models/` - Database models (Connection, QueryHistory, Conversation)
- `backend/src/services/` - Business logic (RAG, Gemini, Query Executor, etc.)
- `backend/src/controllers/` - Request handlers
- `frontend/src/app/` - Next.js pages
- `frontend/src/components/` - React components

### Production Optimization
- ✅ Connection pooling (PostgreSQL/MySQL)
- ✅ Async file operations
- ✅ Graceful shutdown handlers
- ✅ Query timeouts (5 seconds)
- ✅ Vector store caching

### Environment Setup
```bash
# Backend
GEMINI_API_KEY=your_key_here
PORT=3001
NODE_ENV=production

# Start
cd backend && npm start
cd frontend && npm run dev
```

For complete details, see the full [ARCHITECTURE.md](file:///C:/Users/admin/.gemini/antigravity/brain/a0bfce63-f366-428d-831c-bdcdf7754115/ARCHITECTURE.md) document.
