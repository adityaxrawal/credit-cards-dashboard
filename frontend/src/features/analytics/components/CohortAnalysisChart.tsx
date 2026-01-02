import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CohortData {
  month: string;
  [category: string]: any; // dynamic keys
}

interface CohortAnalysisChartProps {
  data: CohortData[];
  categories: string[];
  isLoading?: boolean;
}

const COLORS = [
  '#6ECB8E',
  '#3b82f6',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ef4444',
  '#f59e0b',
];

export function CohortAnalysisChart({ data, categories, isLoading }: CohortAnalysisChartProps) {
    if (isLoading) {
        return (
          <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
             <div className="animate-pulse flex items-center space-x-2">
                <div className="h-4 w-4 bg-primary-green/50 rounded-full"></div>
                <span className="text-secondary-text">Loading Trends...</span>
            </div>
          </div>
        );
    }
    
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
              <span className="text-secondary-text">No trend data available</span>
            </div>
        );
    }

    return (
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                    />
                    {categories.map((category, index) => (
                        <Area 
                            key={category}
                            type="monotone"
                            dataKey={category}
                            stackId="1"
                            stroke={COLORS[index % COLORS.length]}
                            fill={COLORS[index % COLORS.length]}
                            fillOpacity={0.6}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
