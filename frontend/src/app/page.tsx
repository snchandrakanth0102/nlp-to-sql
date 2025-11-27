// page.tsx - Chat UI with Conversation History Sidebar

'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import ResultsTable from '@/components/ResultsTable';
import DataChart from '@/components/DataChart';
import { Send, Code, Database, Loader2, AlertCircle, Lightbulb, Download, BarChart3, Table, Copy, Check, RefreshCw, Settings } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  // Core states
  const [connections, setConnections] = useState<Array<any>>([]);
  const [selectedConn, setSelectedConn] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [loadingStarter, setLoadingStarter] = useState<boolean>(false);

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [conversations, setConversations] = useState<Array<any>>([]);

  // Chat history
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; suggestions?: string[]; result?: any }>>([]);

  // Icon mapping based on keywords
  const getQuestionIcon = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('how many') || q.includes('count') || q.includes('total')) return '🔢';
    if (q.includes('show') || q.includes('list') || q.includes('display')) return '📋';
    if (q.includes('when') || q.includes('date') || q.includes('time')) return '📅';
    if (q.includes('where') || q.includes('city') || q.includes('location') || q.includes('from')) return '📍';
    if (q.includes('which') || q.includes('what') || q.includes('who')) return '❓';
    if (q.includes('top') || q.includes('best') || q.includes('most')) return '🏆';
    if (q.includes('compare') || q.includes('vs') || q.includes('versus')) return '⚖️';
    if (q.includes('trend') || q.includes('over time') || q.includes('growth')) return '📈';
    if (q.includes('chart') || q.includes('graph') || q.includes('visualize')) return '📊';
    return '💡';
  };

  // Load connections once
  useEffect(() => {
    api.get('/connections').then(res => {
      setConnections(res.data);
      if (res.data.length > 0) setSelectedConn(res.data[0].id);
    });
  }, []);

  // Fetch conversations when connection changes
  useEffect(() => {
    if (selectedConn) {
      fetchConversations();
      fetchStarterQuestions();
    }
  }, [selectedConn]);

  const fetchConversations = async () => {
    if (!selectedConn) return;
    try {
      const res = await api.get(`/query/conversations/${selectedConn}`);
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  };

  const fetchStarterQuestions = async () => {
    if (!selectedConn) return;
    setLoadingStarter(true);
    try {
      const res = await api.post('/query/starter-questions', { connectionId: selectedConn });
      setStarterQuestions(res.data.questions);
    } catch (err) {
      console.error('Failed to fetch starter questions', err);
    } finally {
      setLoadingStarter(false);
    }
  };

  const handleNewChat = async () => {
    setChatHistory([]);
    setConversationId(null);
    setQuery('');
    setError(null);
    await fetchStarterQuestions();
    await fetchConversations();
  };

  const [syncing, setSyncing] = useState<boolean>(false);

  // ... (existing code)

  const handleSync = async () => {
    if (!selectedConn) return;
    setSyncing(true);
    try {
      await api.post(`/query/sync/${selectedConn}`);
      // Refresh starter questions after sync as schema might have changed
      await fetchStarterQuestions();
      alert('Schema synced successfully!');
    } catch (err) {
      console.error('Sync failed', err);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/query/conversation/${convId}/messages`);

      // Convert messages to chat history format
      const history: Array<{ role: 'user' | 'assistant'; content: string; suggestions?: string[]; result?: any }> = [];

      res.data.forEach((msg: any) => {
        // Add user message
        history.push({ role: 'user', content: msg.question });
        // Add assistant message with SQL
        history.push({
          role: 'assistant',
          content: '',
          result: { sql: msg.sql }
        });
      });

      setChatHistory(history);
      setConversationId(convId);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load conversation', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = (sql: string) => {
    if (sql) {
      navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (result: any, format: 'csv' | 'pdf') => {
    if (!result?.results) return;
    const data = result.results;
    const fileName = `query_results_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.csv`;
      link.click();
    } else {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text('Query Results Report', 14, y);
      y += 15;
      if (result.insights) {
        doc.setFontSize(14);
        doc.text('Actionable AI Insights', 14, y);
        y += 10;
        doc.setFontSize(10);
        const insights = Array.isArray(result.insights) ? result.insights.map((i: string) => `• ${i}`).join('\n') : result.insights;
        const split = doc.splitTextToSize(insights, 180);
        doc.text(split, 14, y);
        y += split.length * 5 + 10;
      }

      if (result.results && result.results.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.text(`Result Set (${result.results.length} rows)`, 14, y);
        y += 5;
        const headers = Object.keys(result.results[0]);
        const rows = result.results.map((r: any) => headers.map(h => r[h]));
        autoTable(doc, { head: [headers], body: rows, startY: y, margin: { top: 20 }, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
      }
      doc.save(`${fileName}.pdf`);
    }
  };

  const addMessage = (role: 'user' | 'assistant', content: string, suggestions?: string[], result?: any) => {
    setChatHistory(prev => [...prev, { role, content, suggestions, result }]);
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedConn) return;

    // user message
    addMessage('user', query);
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/query/ask', { connectionId: selectedConn, question: query, conversationId });
      setConversationId(res.data.conversationId);

      // Update conversation title if this is the first message
      if (!conversationId && res.data.conversationId) {
        const title = query.length > 50 ? query.substring(0, 50) + '...' : query;
        await api.patch(`/query/conversation/${res.data.conversationId}`, { title });
        await fetchConversations();
      }

      // Build assistant content
      let assistantContent = ''; // Content is now minimal as results are rendered separately

      addMessage('assistant', assistantContent, res.data.suggestedQuestions, res.data);

      // Update chart type if provided
      if (res.data.recommendedChartType && res.data.recommendedChartType !== 'none') {
        setChartType(res.data.recommendedChartType);
      }
      setQuery('');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
      addMessage('assistant', 'Error processing request.');
    } finally {
      setLoading(false);
    }
  };

  // Render helpers
  const renderChat = () => (
    <div className="flex flex-col gap-6 p-4 pb-32">
      {chatHistory.map((msg, idx) => (
        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`max-w-[90%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'} p-4 rounded-xl shadow-md`}>
            {msg.content && <div className="whitespace-pre-wrap mb-2" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />}

            {/* Render Result Content for Assistant */}
            {msg.role === 'assistant' && msg.result && (
              <div className="space-y-6 mt-4 w-full min-w-[600px]">
                {/* RAG Info */}
                <div className="flex gap-4 text-xs text-slate-500">
                  {msg.result.relevantTables && (
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-slate-500" />
                      <span className="font-semibold text-slate-400">Used Tables:</span>
                      {msg.result.relevantTables.map((t: string) => (<span key={t} className="bg-slate-900 px-2 py-1 rounded border border-slate-700">{t}</span>))}
                    </div>
                  )}
                </div>

                {/* SQL */}
                {msg.result.sql && (
                  <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-xs font-medium text-slate-400">
                      <div className="flex items-center gap-2"><Code size={14} /><span>Generated SQL</span></div>
                      <button onClick={() => handleCopySql(msg.result.sql)} className="flex items-center gap-1 hover:text-white transition-colors" title="Copy SQL">
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <pre className="p-4 text-sm text-blue-300 overflow-x-auto font-mono">{msg.result.sql}</pre>
                  </div>
                )}

                {/* Metadata-Only Mode Info Banner */}
                {msg.result.metadataOnly && (
                  <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-amber-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h3 className="text-amber-200 font-semibold mb-1">Metadata-Only Mode</h3>
                      <p className="text-amber-100/80 text-sm">
                        This SQL query was generated based on your database schema metadata.
                        To execute queries and see results, visualizations, and AI insights, please connect to a live database
                        (PostgreSQL, MySQL, or Oracle) from the <a href="/connections" className="underline hover:text-amber-200">Connections</a> page.
                      </p>
                    </div>
                  </div>
                )}

                {/* Visualization */}
                {msg.result.results && msg.result.results.length > 0 && (
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2"><BarChart3 className="text-blue-400" size={20} /><h3 className="text-lg font-semibold text-white">Visualization</h3></div>
                    </div>
                    <DataChart data={msg.result.results} type={chartType} />
                  </div>
                )}

                {/* Insights */}
                {msg.result.insights && (
                  <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex items-start gap-3">
                    <Lightbulb className="text-yellow-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h3 className="text-blue-200 font-semibold mb-1">Actionable AI Insights</h3>
                      <div className="text-blue-100/80 text-sm leading-relaxed">
                        {Array.isArray(msg.result.insights) ? (
                          <ul className="list-disc pl-4 space-y-1">
                            {msg.result.insights.map((ins: string, i: number) => (<li key={i}>{ins}</li>))}
                          </ul>
                        ) : (<p>{msg.result.insights}</p>)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Table */}
                {msg.result.results && msg.result.results.length > 0 && (
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2"><Table size={20} className="text-green-400" /><h3 className="text-lg font-semibold text-white">Result Set ({msg.result.results.length} rows)</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownload(msg.result, 'csv')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> CSV</button>
                        <button onClick={() => handleDownload(msg.result, 'pdf')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> PDF</button>
                      </div>
                    </div>
                    <ResultsTable data={msg.result.results} />
                  </div>
                )}
              </div>
            )}
          </div>


        </div>
      ))}
      {loading && (
        <div className="self-start bg-slate-800 text-slate-200 p-4 rounded-xl shadow-md flex items-center gap-2">
          <Loader2 className="animate-spin" size={20} />
          <span>Thinking...</span>
        </div>
      )}
      <div id="scroll-anchor"></div>
    </div>
  );

  const renderStarter = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto mt-20">
      {loadingStarter ? (
        <div className="col-span-2 flex justify-center p-10">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        starterQuestions.map((q, idx) => (
          <button key={idx} onClick={() => { setQuery(q); handleAsk({ preventDefault: () => { } } as any); }} className="text-left p-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all hover:scale-[1.02] flex items-start gap-3 shadow-lg">
            <span className="text-2xl shrink-0">{getQuestionIcon(q)}</span>
            <span className="font-medium text-lg">{q}</span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <Layout>
      <div className="flex h-full bg-slate-950">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={conversationId}
          onSelectConversation={loadConversation}
          onNewChat={handleNewChat}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content */}
        <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">AI Query Engine</h1>
              {conversationId && <p className="text-xs text-slate-400">Conversation #{conversationId.substring(0, 8)}</p>}
            </div>
            <div className="flex items-center gap-4">
              {selectedConn && (
                <button
                  onClick={() => handleSync()}
                  disabled={syncing}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-900 rounded-lg transition-colors"
                  title="Sync Schema (Generate Vector DB)"
                >
                  <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                </button>
              )}
              <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <Database size={16} className="text-slate-400" />
                <select className="bg-transparent text-white text-sm outline-none min-w-[150px]" value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
                  {connections.length === 0 && <option>No connections</option>}
                  {connections.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <a href="/connections" className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors" title="Manage Connections">
                <Settings size={18} />
              </a>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-4 mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="max-w-5xl mx-auto w-full">
              {chatHistory.length === 0 ? renderStarter() : renderChat()}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <div className="max-w-4xl mx-auto relative">
              <form onSubmit={handleAsk} className="relative">
                <input
                  type="text"
                  placeholder="Ask a question about your data..."
                  className="w-full bg-slate-900 border border-slate-800 text-white p-4 pr-14 rounded-2xl shadow-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  suppressHydrationWarning
                />
                <button
                  type="submit"
                  disabled={loading || !selectedConn}
                  className="absolute right-3 top-3 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              </form>
              <p className="text-center text-xs text-slate-500 mt-2">
                AI can make mistakes. Please verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
