'use client';

import React from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight, Database } from 'lucide-react';

interface Conversation {
    id: string;
    title: string;
    createdAt: string;
    connectionId: string;
}

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewChat: () => void;
    onDeleteConversation?: (id: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onDeleteConversation,
    isOpen,
    onToggle
}: SidebarProps) {

    const groupConversationsByDate = (convos: Conversation[]) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const groups: { [key: string]: Conversation[] } = {
            Today: [],
            Yesterday: [],
            'Last 7 days': [],
            Older: []
        };

        convos.forEach(convo => {
            const date = new Date(convo.createdAt);
            if (date >= today) {
                groups.Today.push(convo);
            } else if (date >= yesterday) {
                groups.Yesterday.push(convo);
            } else if (date >= lastWeek) {
                groups['Last 7 days'].push(convo);
            } else {
                groups.Older.push(convo);
            }
        });

        return groups;
    };

    const groupedConversations = groupConversationsByDate(conversations);

    const truncateTitle = (title: string, maxLength = 30) => {
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength) + '...';
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="fixed top-4 left-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
                title={isOpen ? 'Close sidebar' : 'Open sidebar'}
            >
                {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>

            {/* Sidebar */}
            <div
                className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40 flex flex-col ${isOpen ? 'w-64' : 'w-0'
                    } overflow-hidden`}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                    <button
                        onClick={onNewChat}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                    >
                        <Plus size={18} />
                        <span>New Chat</span>
                    </button>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {Object.entries(groupedConversations).map(([group, convos]) => {
                        if (convos.length === 0) return null;

                        return (
                            <div key={group} className="mb-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2">{group}</h3>
                                <div className="space-y-1">
                                    {convos.map(convo => (
                                        <div
                                            key={convo.id}
                                            className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeConversationId === convo.id
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-300 hover:bg-slate-800/50'
                                                }`}
                                            onClick={() => onSelectConversation(convo.id)}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <MessageSquare size={16} className="shrink-0" />
                                                <span className="text-sm truncate" title={convo.title}>
                                                    {truncateTitle(convo.title)}
                                                </span>
                                            </div>
                                            {onDeleteConversation && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteConversation(convo.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all"
                                                    title="Delete conversation"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {conversations.length === 0 && (
                        <div className="text-center text-slate-500 text-sm mt-8 px-4">
                            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No conversations yet</p>
                            <p className="text-xs mt-1">Start a new chat to begin</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800">
                    <a
                        href="/connections"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm px-2 py-2 rounded-lg hover:bg-slate-800"
                    >
                        <Database size={16} />
                        <span>Manage Connections</span>
                    </a>
                </div>
            </div>
        </>
    );
}
