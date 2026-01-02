import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';

interface SankeyData {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
}

interface SankeyChartProps {
  data: SankeyData;
  isLoading?: boolean;
}

export function SankeyChart({ data, isLoading }: SankeyChartProps) {
  
  // Custom tooltip for Sankey
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { source, target, value } = payload[0].payload;
      return (
        <div className="bg-card-bg border border-muted-text/20 p-2 rounded shadow-lg text-xs">
          <p className="font-semibold text-primary-text">{source.name} → {target.name}</p>
          <p className="text-secondary-text">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
        <div className="animate-pulse flex items-center space-x-2">
            <div className="h-4 w-4 bg-primary-green/50 rounded-full"></div>
            <span className="text-secondary-text">Loading Flow...</span>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
      return (
        <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
            <span className="text-secondary-text">No flow data available</span>
        </div>
      );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          node={{ stroke: 'none', fill: '#6ECB8E' }} // primary-green
          link={{ stroke: '#334155', fill: 'none' }} // slate-700
          nodePadding={50}
          margin={{
            left: 10,
            right: 10,
            top: 10,
            bottom: 10,
          }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
