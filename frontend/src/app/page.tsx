'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import ResultsTable from '@/components/ResultsTable';
import DataChart from '@/components/DataChart';
import { Send, Code, Database, Loader2, AlertCircle, Lightbulb, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [connections, setConnections] = useState([]);
  const [selectedConn, setSelectedConn] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [conversationId, setConversationId] = useState<number | null>(null);

  // Reset conversation when connection changes
  useEffect(() => {
    setConversationId(null);
    setResult(null);
    setQuery('');
  }, [selectedConn]);

  useEffect(() => {
    api.get('/connections').then(res => {
      setConnections(res.data);
      if (res.data.length > 0) setSelectedConn(res.data[0].id);
    });
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedConn) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/query/ask', {
        connectionId: selectedConn,
        question: query,
        conversationId // Pass conversation ID for context
      });
      setResult(res.data);
      setConversationId(res.data.conversationId); // Store returned conversationId
      setQuery(''); // Clear input for next question
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
      if (err.response?.data?.sql) {
        // Even if error, we might have SQL (e.g. execution error)
        setResult({ sql: err.response.data.sql, relevantTables: err.response.data.relevantTables });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'pdf') => {
    if (!result || !result.results) return;

    const data = result.results;
    const fileName = `query_results_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.csv`;
      link.click();
    } else if (format === 'pdf') {
      const element = document.getElementById('results-container');
      if (element) {
        try {
          // Dynamic import to avoid SSR issues
          const domtoimage = (await import('dom-to-image-more')).default;
          const dataUrl = await domtoimage.toPng(element, { quality: 1.0 });
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          const img = new Image();
          img.src = dataUrl;
          await new Promise((resolve) => { img.onload = resolve; });

          const imgWidth = pdfWidth;
          const imgHeight = (img.height * pdfWidth) / img.width;

          pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
          pdf.save(`${fileName}.pdf`);
        } catch (err) {
          console.error("PDF generation failed:", err);
          alert("Failed to generate PDF. Please try again.");
        }
      }
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
        {/* Header & Controls */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">AI Query Engine</h1>
            {conversationId && (
              <p className="text-xs text-slate-400 mt-1">Conversation #{conversationId}</p>
            )}
          </div>
          {conversationId && (
            <button
              onClick={() => {
                setConversationId(null);
                setResult(null);
                setQuery('');
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"
            >
              New Conversation
            </button>
          )}
          <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
            <Database size={16} className="text-slate-400" />
            <select
              className="bg-transparent text-white text-sm outline-none min-w-[150px]"
              value={selectedConn}
              onChange={e => setSelectedConn(e.target.value)}
            >
              {connections.length === 0 && <option>No connections</option>}
              {connections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Chat Input */}
        <div className="mb-8">
          <form onSubmit={handleAsk} className="relative">
            <input
              type="text"
              placeholder="Ask a question about your data (e.g., 'Show me total sales by region')"
              className="w-full bg-slate-900 border border-slate-800 text-white p-4 pr-12 rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !selectedConn}
              className="absolute right-3 top-3 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
        </div>

        {/* Error Display */}
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
          <div
            id="results-container"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
            style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '20px', borderRadius: '12px' }}
          >
            <div className="flex justify-end gap-2" data-html2canvas-ignore="true">
              <button onClick={() => handleDownload('csv')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> CSV</button>
              <button onClick={() => handleDownload('pdf')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded transition-colors"><Download size={14} /> PDF</button>
            </div>

            {/* RAG Info */}
            <div className="flex gap-4 text-xs text-slate-500">
              {result.relevantTables && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-400">Used Tables:</span>
                  {result.relevantTables.map((t: string) => (
                    <span key={t} className="bg-slate-800 px-2 py-1 rounded">{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* SQL Code */}
            <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2 text-xs font-medium text-slate-400">
                <Code size={14} />
                <span>Generated SQL</span>
              </div>
              <pre className="p-4 text-sm text-blue-300 overflow-x-auto font-mono">
                {result.sql}
              </pre>
            </div>

            {/* Insights */}
            {result.insights && (
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex items-start gap-3">
                <Lightbulb className="text-yellow-400 shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="text-blue-200 font-semibold mb-1">AI Insights</h3>
                  <p className="text-blue-100/80 text-sm leading-relaxed">{result.insights}</p>
                </div>
              </div>
            )}

            {/* Visualization */}
            {result.results && result.results.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">Visualization</h3>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                      {['bar', 'pie', 'line'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setChartType(type as any)}
                          className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${chartType === type
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <DataChart data={result.results} type={chartType} />
                </div>
                <div className="lg:col-span-1 bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col">
                  <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-center">
                    <p>Found {result.results.length} records.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            {result.results && (
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Raw Data</h3>
                <ResultsTable data={result.results} />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
