# RAG-Enabled NLP-to-SQL Application
## Complete Architecture & Flow Documentation

---

## 🏗️ **Application Architecture**

### **System Overview**
```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Frontend  │────────▶│   Backend    │────────▶│   Databases    │
│  (Next.js)  │  HTTP   │  (Express)   │  JDBC   │ (PG/MySQL/...)│
└─────────────┘         └──────────────┘         └────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  Gemini API  │
                        │ (LLM + RAG)  │
                        └──────────────┘
```

### **Technology Stack**

#### Backend (`/backend`)
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database (Internal)**: SQLite (for connection/history storage)
- **Database Drivers**: `pg`, `mysql2`, `oracledb`
- **ORM**: Sequelize
- **AI/ML**: Google Gemini API
├── backend/
│   ├── .env                    # Environment variables
│   ├── database.sqlite         # Internal DB (connections, history)
│   ├── vector_store.json       # RAG embeddings cache
│   ├── package.json
│   └── src/
│       ├── app.js              # Express app entry point
│       ├── config/
│       │   ├── database.js     # Sequelize config
│       │   └── metadata.json   # Optional schema descriptions
│       ├── controllers/
│       │   ├── connectionController.js
│       │   └── queryController.js
│       ├── models/
│       │   ├── index.js
│       │   ├── connection.js
│       │   ├── conversation.js     # NEW - Conversation models
│       │   └── queryHistory.js
│       ├── routes/
│       │   ├── index.js
│       │   ├── connectionRoutes.js
│       │   └── queryRoutes.js
│       ├── services/
│       │   ├── connectionService.js
│       │   ├── conversationService.js  # NEW - Conversation management
│       │   ├── geminiService.js
│       │   ├── metadataService.js
│       │   ├── postGuardrailService.js
│       │   ├── preGuardrailService.js
│       │   ├── queryExecutorService.js
│       │   ├── ragService.js
│       │   ├── schemaIngestionService.js
│       │   └── vectorStoreService.js
│       └── utils/
│           └── logger.js
│
└── frontend/
    ├── package.json
    └── src/
        ├── app/
        │   ├── page.tsx            # Dashboard (main query page)
        │   ├── connections/
        │   │   └── page.tsx        # Connection management
        │   └── layout.tsx
        ├── components/
        │   ├── DataChart.tsx
        │   ├── Layout.tsx
        │   └── ResultsTable.tsx
        ├── lib/
        │   └── api.ts              # Axios instance
        └── dom-to-image-more.d.ts  # TypeScript declarations
```

---

## 🔄 **Complete Application Flow**

### **Flow 1: Adding a Database Connection**

```
User (Frontend)
  │
  ├─ Fills connection form (host, port, database, user, password)
  │
  └─→ POST /api/connections/test
      ├─ connectionController.test()
      ├─ → connectionService.testConnection()
      │    └─ Tries to connect to DB (pg/mysql2/oracledb)
      ├─ Returns success/failure
      │
  └─→ POST /api/connections
      ├─ connectionController.create()
      ├─ → connectionService.createConnection()
      │    └─ Saves to SQLite (Connection model)
      └─ Returns connection ID
```

**API Endpoints**:
- `POST /api/connections/test` - Test connection before saving
- `POST /api/connections` - Create new connection
- `GET /api/connections` - List all connections
- `DELETE /api/connections/:id` - Delete connection

---

### **Flow 2: Syncing Schema (RAG Preparation)**

```
User clicks "Sync Schema"
  │
  └─→ POST /api/query/sync/:id
      ├─ queryController.syncSchema()
      ├─ → ragService.syncSchema(connectionId)
      │    ├─ 1. connectionService.getConnectionById()
      │    ├─ 2. schemaIngestionService.fetchSchema()
      │    │     ├─ Queries information_schema (Postgres/MySQL)
      │    │     └─ Returns [{tableName, columns[], description}]
      │    ├─ 3. For each table:
      │    │     ├─ geminiService.getEmbeddings(description)
      │    │     └─ Generate 768-dim vector
      │    ├─ 4. vectorStoreService.saveEmbeddings()
      │    │     └─ Writes to vector_store.json
      │    └─ 5. Update connection.schemaSyncedAt
      └─ Returns {success: true, count: X}
```

**Key Services**:
- `schemaIngestionService` - Fetches schema from DB
- `geminiService` - Generates embeddings
- `vectorStoreService` - Stores/searches vectors

---

### **Flow 3: Query Execution (Main Flow)**

This is the **core flow** of the application:

```
User asks: "Show me top 10 customers by revenue"
  │
  └─→ POST /api/query/ask {connectionId, question}
      ├─ queryController.ask()
      │
      ├─ STEP 1: PRE-GUARDRAIL VALIDATION
      │    ├─ preGuardrailService.validate(question)
      │    ├─ Checks for SQL injection, malicious commands
      │    ├─ Sanitizes input
      │    └─ Returns {passed, sanitizedInput, violations}
      │
      ├─ STEP 2: RAG-BASED SQL GENERATION
      │    ├─ ragService.generateSQL(question, connectionId)
      │    │    ├─ 1. geminiService.getEmbeddings(question)
      │    │    ├─ 2. vectorStoreService.search(embedding)
      │    │    │     └─ Cosine similarity → Top 5 relevant tables
      │    │    ├─ 3. Build context from relevant schema
      │    │    ├─ 4. Construct prompt:
      │    │    │     "You are an SQL expert...
      │    │    │      Schema: [relevant tables]
      │    │    │      Question: [user question]
      │    │    │      Generate SQL..."
      │    │    └─ 5. geminiService.generateSQL(prompt)
      │    │          └─ Returns raw SQL string
      │    └─ Returns {sql, relevantTables[]}
      │
      ├─ STEP 3: POST-GUARDRAIL VALIDATION
      │    ├─ postGuardrailService.validate(sql, relevantTables)
      │    ├─ Checks for:
      │    │     ├─ DROP, DELETE, ALTER commands
      │    │     ├─ Multiple statements
      │    │     ├─ SQL syntax validity
      │    ├─ Sanitizes SQL
      │    └─ Returns {passed, sanitizedSQL, confidenceScore, warnings}
      │
      ├─ STEP 4: SQL EXECUTION
      │    ├─ connectionService.getConnectionById()
      │    ├─ queryExecutorService.executeQuery(connectionId, sql)
      │    │    ├─ Opens connection (pg/mysql2/oracledb)
      │    │    ├─ Executes query
      │    │    └─ Returns rows[]
      │    └─ Tracks execution time
      │
      ├─ STEP 5: INSIGHTS GENERATION
      │    ├─ geminiService.generateInsights(question, results)
      │    ├─ Sends question + first 20 rows to Gemini
      │    └─ Returns "2-line summary"
      │
      ├─ STEP 6: HISTORY LOGGING
      │    └─ QueryHistory.create({question, sql, status, time})
      │
      └─ STEP 7: RESPONSE
           └─ Returns {
                sql, 
                relevantTables, 
                results[], 
                insights,
                confidenceScore,
                warnings,
                executionTimeMs
              }
```

**API Endpoint**:
- `POST /api/query/ask` - Execute natural language query

**Request Example**:
```json
{
  "connectionId": 1,
  "question": "Filter by USA",
  "conversationId": 42  // Optional - for follow-up questions
}
```

**Response Example**:
```json
{
  "sql": "SELECT customer_name, SUM(revenue) as total FROM customers...",
  "relevantTables": ["customers", "orders"],
  "results": [{...}, {...}],
  "insights": "The top customer generated $1.2M in revenue, 40% higher than the second-ranked customer.",
  "confidenceScore": 0.95,
  "warnings": [],
  "executionTimeMs": 234,
  "conversationId": 42
}
```

---

### **Flow 3.5: Conversational Context (NEW)**

This feature enables users to ask follow-up questions in a conversation:

```
User asks: "Show me all customers"
  │
  └─→ POST /api/query/ask {connectionId, question}
      ├─ No conversationId provided
      ├─ queryController creates new Conversation
      ├─ SQL generated: "SELECT * FROM customers"
      ├─ conversationService.addMessage(conversationId, question, sql)
      └─ Returns {conversationId: 42, results, ...}

User asks: "Filter by USA" (same session)
  │
  └─→ POST /api/query/ask {connectionId, question, conversationId: 42}
      ├─ conversationId provided
      ├─ conversationService.getHistory(42, limit=5)
      │     └─ Returns [{question: "Show me all customers", sql: "SELECT * FROM customers"}]
      ├─ ragService.generateSQL(question, connectionId, history)
      │     ├─ Includes conversation history in prompt:
      │     │   "Previous conversation:
      │     │    Q1: Show me all customers
      │     │    SQL1: SELECT * FROM customers
      │     │    Current question: Filter by USA"
      │     └─ LLM understands context → generates filtered query
      ├─ SQL generated: "SELECT * FROM customers WHERE country = 'USA'"
      ├─ conversationService.addMessage(42, "Filter by USA", sql)
      └─ Returns {conversationId: 42, results, ...}
```

**Key Components**:
- `Conversation` model - Stores conversation metadata
- `ConversationMessage` model - Stores each Q&A pair
- `conversationService` - Manages conversation CRUD operations
- Frontend - Maintains `conversationId` state, shows "Conversation #42" indicator

**Conversation Lifecycle**:
1. First question → Creates new conversation
2. Follow-up questions → Uses existing conversationId
3. "New Conversation" button → Resets conversationId to null
4. Switching connections → Auto-resets conversation

---


## 🧩 **Service Layer Details**

### **1. connectionService**
- **Purpose**: Manage database connections
- **Methods**:
  - `createConnection(data)` - Save to SQLite
  - `getConnectionById(id)` - Retrieve connection
  - `testConnection(data)` - Test DB connectivity
  - `deleteConnection(id)` - Remove connection

### **2. geminiService**
- **Purpose**: Interface with Google Gemini API
- **Methods**:
  - `generateSQL(prompt)` - Generate SQL from prompt
  - `getEmbeddings(text)` - Generate 768-dim vector
  - `generateInsights(question, data)` - Summarize results

### **3. ragService**
- **Purpose**: Orchestrate RAG workflow
- **Methods**:
  - `syncSchema(connectionId)` - Fetch schema + generate embeddings
  - `generateSQL(question, connectionId)` - RAG-based SQL generation

### **4. vectorStoreService**
- **Purpose**: Vector storage and similarity search
- **Methods**:
  - `saveEmbeddings(connectionId, items)` - Store vectors
  - `search(queryVector, connectionId, topK)` - Cosine similarity search

### **5. schemaIngestionService**
- **Purpose**: Fetch database schema
- **Methods**:
  - `fetchSchema(connection)` - Query `information_schema`
  - `_fetchPostgresSchema()`, `_fetchMySQLSchema()`, etc.

### **6. queryExecutorService**
- **Purpose**: Execute SQL against target databases
- **Methods**:
  - `executeQuery(connectionId, sql)` - Execute and return rows
  - Safety check: Blocks DML/DDL commands

### **7. preGuardrailService**
- **Purpose**: Validate user input
- **Methods**:
  - `validate(question)` - Check for SQL injection, XSS

### **8. postGuardrailService**
- **Purpose**: Validate generated SQL
- **Methods**:
  - `validate(sql, tables)` - Check for destructive commands

### **9. conversationService (NEW)**
- **Purpose**: Manage conversation history
- **Methods**:
  - `createConversation(connectionId)` - Start new conversation
  - `addMessage(conversationId, question, sql)` - Save Q&A pair
  - `getHistory(conversationId, limit)` - Fetch recent messages
  - `getConversation(conversationId)` - Get conversation metadata

---

## 🎨 **Frontend Flow**

### **Dashboard (`/app/page.tsx`)**

```
User Journey:
1. Select connection from dropdown
2. Type question: "Show me..."
3. Click Send
   ├─ calls api.post('/query/ask', {connectionId, question})
   ├─ Shows loading spinner
   └─ Receives response
4. Display results:
   ├─ SQL Code block
   ├─ AI Insights card
   ├─ Visualization (Bar/Pie/Line)
   └─ Results Table
5. Download results:
   ├─ CSV → XLSX.utils.json_to_sheet(data)
   └─ PDF → domtoimage.toPng() + jsPDF.addImage()
```

### **Connections Page (`/app/connections/page.tsx`)**

```
User Journey:
1. Click "Add Connection"
2. Select DB type
3. Fill form
4. Click "Test Connection"
   └─ api.post('/connections/test')
5. Click "Save & Connect"
   └─ api.post('/connections')
6. Click "Sync Schema"
   └─ api.post('/query/sync/:id')
7. Click Delete (trash icon)
   └─ api.delete('/connections/:id')
```

---

## 🔐 **Security & Guardrails**

### **Pre-Guardrails (User Input)**
- ✓ SQL injection detection
- ✓ XSS prevention
- ✓ Input sanitization
- ✓ Length limits

### **Post-Guardrails (Generated SQL)**
- ✓ Block DROP/DELETE/ALTER/TRUNCATE
- ✓ Block multi-statement queries
- ✓ Syntax validation
- ✓ Table name verification

### **Environment Security**
- ✓ Sensitive data in `.env`
- ✓ `.gitignore` covers secrets
- ✓ Database credentials encrypted in transit

---

## 🚀 **Production Deployment Guide**

###  **1. Environment Setup**

Create `.env` file:
```bash
GEMINI_API_KEY=your_actual_key_here
PORT=3001
NODE_ENV=production
```

### **2. Backend Deployment**

```bash
cd backend
npm install --production
npm start
```

**Production Checklist**:
- [ ] Set `GEMINI_API_KEY`
- [ ] Configure `NODE_ENV=production`
- [ ] Use process manager (PM2 or systemd)
- [ ] Set up reverse proxy (Nginx)
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain

**PM2 Example**:
```bash
pm2 start src/app.js --name nlp2sql-backend
pm2 save
pm2 startup
```

### **3. Frontend Deployment**

```bash
cd frontend
npm install
npm run build
npm start
```

**Production Checklist**:
- [ ] Update API base URL in `src/lib/api.ts`
- [ ] Configure environment variables
- [ ] Set up CDN for static assets
- [ ] Enable caching headers

### **4. Database Setup**

**Internal SQLite** (auto-created):
- Lives at `backend/database.sqlite`
- Stores connections and query history
- No manual setup needed

**Target Databases** (user-configured):
- PostgreSQL: Ensure `pg_hba.conf` allows connections
- MySQL: Create user with SELECT privileges
- Oracle: Install Oracle Instant Client

### **5. Monitoring & Logging**

**Winston Logs**:
- `combined.log` - All requests
- `error.log` - Errors only
- Configure log rotation in production

**Health Check**:
```bash
curl http://localhost:3001/health
# Returns: {"status": "ok", "timestamp": "..."}
```

### **6. Scaling Considerations**

- **Horizontal Scaling**: Deploy multiple backend instances behind load balancer
- **Caching**: Add Redis for vector store caching
- **Rate Limiting**: Implement per-user API limits
- **Database Pooling**: Configure connection pooling for each DB driver

---

## 📊 **API Reference**

### **Connections**

| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| POST | `/api/connections/test` | `{type, host, port, database, username, password}` | `{success, message}` |
| POST | `/api/connections` | `{name, type, host, port, database, username, password}` | `{id, name, ...}` |
| GET | `/api/connections` | - | `[{id, name, type, ...}]` |
| DELETE | `/api/connections/:id` | - | `204 No Content` |

### **Queries**

| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| POST | `/api/query/sync/:id` | - | `{success, count}` |
| POST | `/api/query/ask` | `{connectionId, question}` | `{sql, results, insights, ...}` |

---

## 🧪 **Testing Flow**

### **Quick Test (Mock DB)**
```bash
# 1. Start servers
cd backend && npm start
cd frontend && npm run dev

# 2. Open browser
http://localhost:3000

# 3. Add Mock DB connection
Type: Mock DB
Name: Test DB

# 4. Sync schema
Click "Sync Schema"

# 5. Ask question
"Show me all customers"

# Expected: Returns mock data + insights
```

---

## 📝 **Configuration Files**

### **`.env` (Backend)**
```
GEMINI_API_KEY=your_key
PORT=3001
NODE_ENV=development
```

### **`metadata.json`** (Optional)
```json
{
  "tables": [
    {
      "table_name": "customers",
      "description": "Stores customer demographics...",
      "columns": [...]
    }
  ]
}
```

---

## ⚙️ **Key Design Decisions**

1. **SQLite for Internal DB**: Simple, zero-config, embedded
2. **RAG Pattern**: Reduces token usage, improves accuracy
3. **Guardrails**: Two-layer validation for security
4. **Vector Store as JSON**: Simple persistence, no extra DB
5. **Dynamic Imports**: Fixes SSR issues with browser-only libs
6. **Metadata Optional**: Works without it, enhanced with it

---

## 🎯 **Performance Optimizations**

- Vector search limited to top-5 tables (configurable)
- Insights use only first 20 rows (avoid token limits) 
- Connection pooling for database drivers
- Lazy loading of PDF/Excel libraries

---

This documentation provides a complete view of how the application works from user interaction to database execution and back.
