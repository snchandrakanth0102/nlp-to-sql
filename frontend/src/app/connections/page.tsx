'use client';

import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Plus, RefreshCw, Check, Database, Server, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConnectionsPage() {
    const [connections, setConnections] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '', type: 'postgres', host: 'localhost', port: 5432, database: '', username: '', password: ''
    });
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);

    useEffect(() => {
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        try {
            const res = await api.get('/connections');
            setConnections(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const testRes = await api.post('/connections/test', formData);
            if (testRes.data.success) {
                await api.post('/connections', formData);
                setShowForm(false);
                fetchConnections();
            } else {
                alert('Connection failed: ' + testRes.data.message);
            }
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        try {
            await api.post(`/query/sync/${id}`);
            fetchConnections();
            alert('Schema synced successfully!');
        } catch (err) {
            console.error(err);
            alert('Sync failed');
        } finally {
            setSyncing(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this connection?')) return;
        try {
            await api.delete(`/connections/${id}`);
            fetchConnections();
        } catch (err) {
            console.error(err);
            alert('Failed to delete connection');
        }
    };

    return (
        <Layout>
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Data Connections</h1>
                        <p className="text-slate-400 mt-1">Manage your database sources for the AI engine.</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                    >
                        <Plus size={18} />
                        Add Connection
                    </button>
                </div>

                {showForm && (
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 mb-8 animate-in fade-in slide-in-from-top-4">
                        <h2 className="text-xl font-semibold text-white mb-4">New Connection</h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input placeholder="Connection Name" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            <select className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="postgres">PostgreSQL</option>
                                <option value="mysql">MySQL</option>
                                <option value="oracle">Oracle</option>
                                <option value="mock">Mock DB (Testing)</option>
                            </select>
                            <input placeholder="Host" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.host} onChange={e => setFormData({ ...formData, host: e.target.value })} required />
                            <input placeholder="Port" type="number" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.port} onChange={e => setFormData({ ...formData, port: e.target.value ? parseInt(e.target.value) : '' as any })} required />
                            <input placeholder="Database Name" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.database} onChange={e => setFormData({ ...formData, database: e.target.value })} required />
                            <input placeholder="Username" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                            <input placeholder="Password" type="password" className="bg-slate-950 border border-slate-800 p-3 rounded text-white" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />

                            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg flex items-center gap-2">
                                    {loading ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                                    Save & Connect
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {connections.map((conn: any) => (
                        <div key={conn.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-slate-800 rounded-lg text-blue-400">
                                    <Database size={24} />
                                </div>
                                <div className={cn("px-2 py-1 rounded text-xs font-medium", conn.schemaSyncedAt ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400")}>
                                    {conn.schemaSyncedAt ? 'Synced' : 'Not Synced'}
                                </div>
                            </div>

                            <h3 className="text-lg font-semibold text-white mb-1">{conn.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                                <Server size={14} />
                                <span>{conn.host}:{conn.port}</span>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex gap-2">
                                <button
                                    onClick={() => handleSync(conn.id)}
                                    disabled={syncing === conn.id}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RefreshCw size={14} className={cn(syncing === conn.id && "animate-spin")} />
                                    {syncing === conn.id ? 'Syncing...' : 'Sync Schema'}
                                </button>
                                <button
                                    onClick={() => handleDelete(conn.id)}
                                    className="bg-red-900/30 hover:bg-red-900/50 text-red-400 p-2 rounded-lg transition-colors"
                                    title="Delete Connection"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}
