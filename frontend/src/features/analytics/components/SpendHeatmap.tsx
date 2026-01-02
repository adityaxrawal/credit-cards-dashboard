import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Scatter, Tooltip, Cell, ZAxis } from 'recharts';
import { format, getDay, getWeek, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface HeatmapDataPoint {
  date: string;
  value: number;
}

interface SpendHeatmapProps {
  data: HeatmapDataPoint[];
  isLoading?: boolean;
}

export function SpendHeatmap({ data, isLoading }: SpendHeatmapProps) {
  
  if (isLoading) {
      return (
        <div className="h-[250px] w-full flex items-center justify-center bg-card-bg rounded-xl">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="h-4 w-4 bg-primary-green/50 rounded-full"></div>
            <span className="text-secondary-text">Loading Heatmap...</span>
          </div>
        </div>
      );
  }

  // Transform date-value data into (x: week, y: dayOfWeek) coordinates
  // We want to show a calendar view. 
  // x-axis: Week of Month/Year
  // y-axis: Day of Week (Sun-Sat)
  
  // 1. Fill missing dates with 0 if necessary or just map existing.
  // Assuming 'data' covers the range of interest.
  
  const processedData = data.map(item => {
      const date = parseISO(item.date);
      return {
          ...item,
          x: getWeek(date), // rough week number
          y: getDay(date), // 0=Sunday, 6=Saturday
          formattedDate: format(date, 'MMM d, yyyy')
      };
  });

  // Determine domain for color scaling
  const maxValue = Math.max(...processedData.map(d => d.value), 0);

  const getColor = (value: number) => {
      if (value === 0) return '#1e293b'; // card-bg/slate-800 -ish
      const intensity = Math.min((value / maxValue), 1);
      // Interpolate between slate-700 and primary-green (#6ECB8E)
      // Simple opacity approach or step approach
      if (intensity < 0.2) return '#334155';
      if (intensity < 0.5) return '#4ade80'; // light green
      return '#6ECB8E'; // primary green
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { formattedDate, value } = payload[0].payload;
      return (
        <div className="bg-card-bg border border-muted-text/20 p-2 rounded shadow-lg text-xs">
          <p className="font-semibold text-primary-text">{formattedDate}</p>
          <p className="text-secondary-text">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}</p>
        </div>
      );
    }
    return null;
  };
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis 
            type="number" 
            dataKey="x" 
            name="week" 
            tick={false} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="day" 
            tickFormatter={(val) => days[val]}
            tickCount={7}
            domain={[0, 6]}
            reversed // Sun at top usually
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={processedData} shape="square">
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.value)} stroke="#0f172a" strokeWidth={2} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
