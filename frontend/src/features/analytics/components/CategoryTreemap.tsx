import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

interface TreemapDataPoint {
  name: string;
  value: number; // size
}

interface CategoryTreemapProps {
  data: TreemapDataPoint[];
  isLoading?: boolean;
}

const COLORS = [
  '#6ECB8E', // Primary Green
  '#3b82f6', // semantic-blue
  '#a855f7', // accent-purple
  '#f97316', // accent-orange
  '#06b6d4', // accent-cyan
  '#ef4444', // semantic-red (rarely for categories but possible)
  '#f59e0b', // semantic-amber
];

const CustomizedContent = (props: any) => {
  const { root, depth, x, y, width, height, index, payload, colors, name, value } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: COLORS[index % COLORS.length],
          stroke: '#1e293b', // card-bg
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
          fontWeight="bold"
        >
          {name}
        </text>
      )}
      {width > 50 && height > 50 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
          >
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits:0 }).format(value)}
          </text>
      )}
    </g>
  );
};

export function CategoryTreemap({ data, isLoading }: CategoryTreemapProps) {
    if (isLoading) {
        return (
          <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
            <div className="animate-pulse flex items-center space-x-2">
              <div className="h-4 w-4 bg-primary-green/50 rounded-full"></div>
              <span className="text-secondary-text">Loading Categorization...</span>
            </div>
          </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center bg-card-bg rounded-xl">
              <span className="text-secondary-text">No category data available</span>
            </div>
        );
    }

    return (
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <Treemap
                    data={data}
                    dataKey="value"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    fill="#8884d8"
                    content={<CustomizedContent />}
                >
                     <Tooltip 
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const { name, value } = payload[0].payload;
                                return (
                                    <div className="bg-card-bg border border-muted-text/20 p-2 rounded shadow-lg text-xs">
                                        <p className="font-semibold text-primary-text">{name}</p>
                                        <p className="text-secondary-text">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                     />
                </Treemap>
            </ResponsiveContainer>
        </div>
    );
}
