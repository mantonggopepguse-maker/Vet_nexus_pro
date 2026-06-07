import React from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ReferenceLine, Legend, AreaChart, Area
} from 'recharts';
import { LabResult } from '../../types';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';

interface LabTrendAnalyzerProps {
    results: LabResult[];
    testName: string;
}

const LabTrendAnalyzer: React.FC<LabTrendAnalyzerProps> = ({ results, testName }) => {
    // Filter results for this specific test and ensure they have a numerical value
    const chartData = results
        .filter(r => r.testName.toLowerCase() === testName.toLowerCase() && r.numericalValue !== undefined)
        .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime())
        .map(r => ({
            date: new Date(r.testDate).toLocaleDateString(),
            value: r.numericalValue,
            unit: r.unit,
            referenceRange: r.referenceRange,
            findings: r.findings
        }));

    if (chartData.length < 2) {
        return (
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <TrendingUp className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 italic">Not enough data points for "{testName}" trends yet.</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Need at least 2 numerical entries</p>
            </div>
        );
    }

    // Attempt to parse reference range (e.g., "70-120")
    let minRef: number | undefined;
    let maxRef: number | undefined;
    if (chartData[0].referenceRange) {
        const parts = chartData[0].referenceRange.split('-');
        if (parts.length === 2) {
            minRef = parseFloat(parts[0]);
            maxRef = parseFloat(parts[1]);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Historical Trend: {testName}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400">Tracking {chartData.length} diagnostic results over time</p>
                </div>
                {chartData[chartData.length - 1].unit && (
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                        Unit: {chartData[chartData.length - 1].unit}
                    </span>
                )}
            </div>

            <div className="h-[220px] w-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            width={30}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontWeight: '700',
                                fontSize: '10px'
                            }}
                        />
                        {minRef !== undefined && (
                            <ReferenceLine y={minRef} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: 'Low', position: 'insideLeft', fill: '#94a3b8', fontSize: 8 }} />
                        )}
                        {maxRef !== undefined && (
                            <ReferenceLine y={maxRef} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: 'High', position: 'insideLeft', fill: '#94a3b8', fontSize: 8 }} />
                        )}
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorValue)" 
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {chartData.some(d => minRef !== undefined && (d.value < minRef || d.value > (maxRef || 999999))) && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 p-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Some results are outside the reference range
                </div>
            )}
        </div>
    );
};

export default LabTrendAnalyzer;
