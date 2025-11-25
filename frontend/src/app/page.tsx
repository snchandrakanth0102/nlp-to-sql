// page.tsx - Refactored Chatbot UI with Persistent History

'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import ResultsTable from '@/components/ResultsTable';
import DataChart from '@/components/DataChart';
import { Send, Code, Database, Loader2, AlertCircle, Lightbulb, Download, BarChart3, Table, Copy, Check } from 'lucide-react';
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
  const [result, setResult] = useState<any>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Chat history persisted in localStorage
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; suggestions?: string[] }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatHistory');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Starter questions – database‑specific
  const starterQuestions: string[] = [
    'Show me all records',
    'How many total entries are there?',
    'What are the top 10 items?',
    'Show me recent entries from this year',
    'Display data grouped by category',
  ];

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

  // Reset conversation when connection changes
  useEffect(() => {
    setConversationId(null);
    setResult(null);
    setQuery('');
    // Do not clear chatHistory to preserve persisted messages across refreshes
  }, [selectedConn]);

  const handleCopySql = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (format: 'csv' | 'pdf') => {
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
      const chartEl = document.getElementById('chart-container');
      if (chartEl) {
        const domtoimage = (await import('dom-to-image-more')).default;
        const dataUrl = await domtoimage.toPng(chartEl, { quality: 1.0 });
        const imgW = 180;
        const imgH = (await new Promise<HTMLImageElement>((res) => {
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => res(img);
        })).height * (imgW / (await new Promise<HTMLImageElement>((res) => {
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => res(img);
        })).width);
        if (y + imgH > 280) { doc.addPage(); y = 20; }
        doc.addImage(dataUrl, 'PNG', 14, y, imgW, imgH);
        y += imgH + 15;
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

  const addMessage = (role: 'user' | 'assistant', content: string, suggestions?: string[]) => {
    setChatHistory(prev => [...prev, { role, content, suggestions }]);
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
      setResult(res.data);
      setConversationId(res.data.conversationId);
      // Build assistant content
      let assistantContent = '';
      if (res.data.sql) assistantContent += `**SQL**:\n\n${res.data.sql}\n\n`;
      if (res.data.insights && res.data.insights.length) {
        assistantContent += '**Insights:**\n' + res.data.insights.map((i: string) => `- ${i}`).join('\n') + '\n';
      }
      addMessage('assistant', assistantContent, res.data.suggestedQuestions);
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
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-4 bg-slate-900 rounded-xl border border-slate-800">
      {chatHistory.map((msg, idx) => (
        <div key={idx} className={msg.role === 'user' ? 'self-end text-right' : 'self-start'}>
          <div className={msg.role === 'user' ? 'bg-blue-600 text-white inline-block p-3 rounded-lg' : 'bg-slate-800 text-slate-200 inline-block p-3 rounded-lg'}>
            <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
          </div>
          {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {msg.suggestions.map((q, sIdx) => (
                <button key={sIdx} onClick={() => { setQuery(q); handleAsk({ preventDefault: () => { } } as any); }} className="w-full text-left p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded">
                  {getQuestionIcon(q)} {q}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderStarter = () => (
    <div className="space-y-2 mb-4">
      {starterQuestions.map((q, idx) => (
        <button key={idx} onClick={() => { setQuery(q); handleAsk({ preventDefault: () => { } } as any); }} className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-start gap-2">
          <span className="text-lg shrink-0">{getQuestionIcon(q)}</span>
          <span>{q}</span>
        </button>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">AI Query Engine</h1>
            {conversationId && <p className="text-xs text-slate-400 mt-1">Conversation #{conversationId}</p>}
          </div>
          <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
            <Database size={16} className="text-slate-400" />
            <select className="bg-transparent text-white text-sm outline-none min-w-[150px]" value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
              {connections.length === 0 && <option>No connections</option>}
              {connections.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Results Area */}
        {result && (
          <div id="results-container" className="space-y-6" style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            {/* RAG Info */}
            <div className="flex gap-4 text-xs text-slate-500">
              {result.relevantTables && (
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-slate-500" />
                  <span className="font-semibold text-slate-400">Used Tables:</span>
                  {result.relevantTables.map((t: string) => (<span key={t} className="bg-slate-800 px-2 py-1 rounded">{t}</span>))}
                </div>
              )}
            </div>
            {/* SQL */}
            <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-medium text-slate-400">
                <div className="flex items-center gap-2"><Code size={14} /><span>Generated SQL</span></div>
                <button onClick={handleCopySql} className="flex items-center gap-1 hover:text-white transition-colors" title="Copy SQL">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
              <pre className="p-4 text-sm text-blue-300 overflow-x-auto font-mono">{result.sql}</pre>
            </div>
            {/* Visualization */}
            {result.results && result.results.length > 0 && (
              <div id="chart-container" className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2"><BarChart3 className="text-blue-400" size={20} /><h3 className="text-lg font-semibold text-white">Visualization</h3></div>
                </div>
                <DataChart data={result.results} type={chartType} />
              </div>
            )}
            {/* Insights */}
            {result.insights && (
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex items-start gap-3">
                <Lightbulb className="text-yellow-400 shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="text-blue-200 font-semibold mb-1">Actionable AI Insights</h3>
                  <div className="text-blue-100/80 text-sm leading-relaxed">
                    {Array.isArray(result.insights) ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {result.insights.map((ins: string, i: number) => (<li key={i}>{ins}</li>))}
                      </ul>
                    ) : (<p>{result.insights}</p>)}
                  </div>
                </div>
              </div>
            )}
            {/* Data Table */}
            {result.results && result.results.length > 0 && (
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2"><Table size={20} className="text-green-400" /><h3 className="text-lg font-semibold text-white">Result Set ({result.results.length} rows)</h3></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('csv')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> CSV</button>
                    <button onClick={() => handleDownload('pdf')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> PDF</button>
                  </div>
                </div>
                <ResultsTable data={result.results} />
              </div>
            )}
          </div>
        )}

        {/* Chat Area */}
        {chatHistory.length === 0 ? renderStarter() : renderChat()}

        {/* Chat Input – always at bottom */}
        <div className="mt-4">
          <form onSubmit={handleAsk} className="relative">
            <input type="text" placeholder="Ask a question about your data..." className="w-full bg-slate-900 border border-slate-800 text-white p-4 pr-12 rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={query} onChange={e => setQuery(e.target.value)} />
            <button type="submit" disabled={loading || !selectedConn} className="absolute right-3 top-3 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
