import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', progress: 10 },
  { name: 'Tue', progress: 30 },
  { name: 'Wed', progress: 20 },
  { name: 'Thu', progress: 50 },
  { name: 'Fri', progress: 40 },
  { name: 'Sat', progress: 70 },
  { name: 'Sun', progress: 90 },
];

export function ProgressChart() {
  return (
    <div className="h-64 w-full bg-white p-4 rounded-3xl border border-slate-150/70 shadow-xs">
      <h3 className="text-xs font-extrabold text-slate-800 tracking-tight uppercase mb-4">Learning Progress (7 Days)</h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" />
          <YAxis fontSize={10} stroke="#94a3b8" />
          <Tooltip 
            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Area type="monotone" dataKey="progress" stroke="#6366f1" fillOpacity={1} fill="url(#colorProgress)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
