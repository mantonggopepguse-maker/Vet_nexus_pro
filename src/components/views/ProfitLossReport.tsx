import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, PieChart, Calendar, RefreshCw, ChevronRight, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../../services/apiService';
import { ClinicSettings } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePie, Pie } from 'recharts';

interface ProfitLossReportProps {
    settings: ClinicSettings;
}

export const ProfitLossReport: React.FC<ProfitLossReportProps> = ({ settings }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<'Month' | 'Week' | 'Today' | 'Year'>('Month');
    const [inventoryCategories, setInventoryCategories] = useState<string[]>([]);
    const [procedureCategories, setProcedureCategories] = useState<string[]>([]);
    const [selectedInventoryCategory, setSelectedInventoryCategory] = useState<string>('');
    const [selectedProcedureCategory, setSelectedProcedureCategory] = useState<string>('');

    const fetchReport = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let start = new Date();

            if (dateRange === 'Today') start.setHours(0, 0, 0, 0);
            else if (dateRange === 'Week') start.setDate(now.getDate() - 7);
            else if (dateRange === 'Month') start.setMonth(now.getMonth() - 1);
            else if (dateRange === 'Year') start.setFullYear(now.getFullYear() - 1);

            const params: any = {
                startDate: start.toISOString(),
                endDate: now.toISOString()
            };
            if (selectedInventoryCategory) params.inventoryCategory = selectedInventoryCategory;
            if (selectedProcedureCategory) params.procedureCategory = selectedProcedureCategory;

            const report = await api.reports.getProfitLoss(params);
            setData(report);

            // Update category lists from response
            if (report.categories) {
                setInventoryCategories(report.categories.inventory || []);
                setProcedureCategories(report.categories.procedures || []);
            }
        } catch (error) {
            console.error("Failed to fetch P&L report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [dateRange, selectedInventoryCategory, selectedProcedureCategory]);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mb-4" />
                <p className="text-slate-500 font-bold">Calculating Profit & Loss...</p>
            </div>
        );
    }

    const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3B82F6', '#ef4444'];

    const pieData = [
        { name: 'Products', value: data?.summary?.productProfit || 0 },
        { name: 'Procedures', value: data?.summary?.procedureProfit || 0 }
    ].filter(d => d.value > 0);

    const chartData = data?.breakdown?.slice(0, 8).map((item: any) => ({
        name: item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name,
        profit: item.profit,
        revenue: item.revenue
    })) || [];

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        Profit & <span className="text-amber-600">Loss</span> Analysis
                    </h1>
                    <p className="text-slate-500 font-bold">Performance based on service markup and product interest</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                        {(['Today', 'Week', 'Month', 'Year'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${dateRange === range ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    {/* Category Filters */}
                    <div className="flex gap-2">
                        <select
                            value={selectedInventoryCategory}
                            onChange={(e) => setSelectedInventoryCategory(e.target.value)}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-amber-300 transition-colors"
                        >
                            <option value="">All Inventory</option>
                            {inventoryCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <select
                            value={selectedProcedureCategory}
                            onChange={(e) => setSelectedProcedureCategory(e.target.value)}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-amber-300 transition-colors"
                        >
                            <option value="">All Procedures</option>
                            {procedureCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="premium-glass-neo p-8 bg-white border-l-4 border-emerald-500 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Inflow</span>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                            <span>Gross Sales:</span>
                            <span>{settings.currencySymbol}{Math.round(data?.summary?.totalSubtotal || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-rose-400">
                            <span>Discounts:</span>
                            <span>-{settings.currencySymbol}{Math.round(data?.summary?.totalDiscount || 0).toLocaleString()}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-lg font-black text-emerald-600">
                            <span>Net Sales:</span>
                            <span>{settings.currencySymbol}{Math.round((data?.summary?.totalSubtotal || 0) - (data?.summary?.totalDiscount || 0)).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="premium-glass-neo p-8 bg-white border-l-4 border-rose-500 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Costs</span>
                        <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                            <span>COGS:</span>
                            <span>{settings.currencySymbol}{Math.round(data?.summary?.totalCostOfSales || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                            <span>Expenses:</span>
                            <span>{settings.currencySymbol}{Math.round(data?.summary?.totalOperationalExpenses || 0).toLocaleString()}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-lg font-black text-rose-600">
                            <span>Total:</span>
                            <span>{settings.currencySymbol}{Math.round((data?.summary?.totalCostOfSales || 0) + (data?.summary?.totalOperationalExpenses || 0)).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="premium-glass-neo p-8 bg-amber-600 text-white shadow-xl shadow-amber-200 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-amber-200">Net Clinic Profit</span>
                        <div className="p-2 bg-white/10 rounded-lg text-white">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-sm font-bold text-amber-100 italic">
                            <span>Gross:</span>
                            <span>{settings.currencySymbol}{Math.round(data?.summary?.grossProfit || 0).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-3xl font-black">{settings.currencySymbol}{Math.round(data?.summary?.netProfit || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-100">
                        <Activity className="w-3 h-3" />
                        Real profit after all expenses
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Performance Chart */}
                <div className="soft-card p-6 flex flex-col h-[400px]">
                    <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2 uppercase text-xs tracking-wider">
                        <Activity className="w-4 h-4 text-amber-500" /> Top Profitable Items
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]} fill="#8b5cf6" barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Breakdown Pie */}
                <div className="soft-card p-6 flex flex-col h-[400px]">
                    <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2 uppercase text-xs tracking-wider">
                        <PieChart className="w-4 h-4 text-amber-500" /> Revenue Source Breakdown
                    </h3>
                    <div className="flex-1 flex justify-center items-center relative">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePie>
                                    <Pie
                                        data={pieData}
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RePie>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-slate-400 font-bold text-sm">No data for this period</p>
                        )}
                        <div className="absolute flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Net Profit</span>
                            <span className="text-lg font-black text-slate-800">{settings.currencySymbol}{Math.round(data?.summary?.netProfit || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="soft-card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-slate-700 uppercase text-xs tracking-wider">Performance Breakdown</h3>
                    <span className="bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                        {data?.breakdown?.length || 0} Total Items
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Item/Service</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-center">Qty</th>
                                <th className="px-6 py-4 text-right">Revenue</th>
                                <th className="px-6 py-4 text-right text-rose-400">Cost</th>
                                <th className="px-6 py-4 text-right text-emerald-600 font-black">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data?.breakdown?.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700 text-sm group-hover:text-amber-600 transition-colors">{item.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${item.type === 'Product' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-600 text-sm">{item.quantity}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700 text-sm">{settings.currencySymbol}{Math.round(item.revenue).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-rose-400 text-sm">{settings.currencySymbol}{Math.round(item.cost).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 font-black text-emerald-600 text-sm">
                                            {settings.currencySymbol}{Math.round(item.profit).toLocaleString()}
                                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(!data?.breakdown || data.breakdown.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold italic">No transactions found for the selected period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
