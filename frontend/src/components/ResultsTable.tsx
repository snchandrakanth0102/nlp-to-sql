import React from 'react';

export default function ResultsTable({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="text-slate-400 p-4">No data returned.</div>;

    const headers = Object.keys(data[0]);

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-900 text-slate-400">
                    <tr>
                        {headers.map(h => (
                            <th key={h} className="px-6 py-3">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="bg-slate-950 border-b border-slate-800 hover:bg-slate-900">
                            {headers.map(h => (
                                <td key={`${i}-${h}`} className="px-6 py-4 font-medium text-white whitespace-nowrap">
                                    {String(row[h])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
