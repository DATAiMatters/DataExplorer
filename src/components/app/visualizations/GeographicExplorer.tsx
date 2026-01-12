import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Eye, MapPin } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface GeoPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  category?: string;
  value?: number;
  address?: string;
}

// Reference cities for context (offline)
const REFERENCE_CITIES = [
  { name: 'New York', lat: 40.7128, lon: -74.0060, type: 'major' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, type: 'major' },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, type: 'major' },
  { name: 'London', lat: 51.5074, lon: -0.1278, type: 'major' },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, type: 'major' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, type: 'major' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, type: 'major' },
];

export function GeographicExplorer({ bundle }: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<GeoPoint | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');
  const [showReferenceCities, setShowReferenceCities] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Extract geographic data from bundle
  const geoData = useMemo(() => {
    const nameRole = bundle.mappings.find((m) => m.roleId === 'location_name');
    const latRole = bundle.mappings.find((m) => m.roleId === 'latitude');
    const lonRole = bundle.mappings.find((m) => m.roleId === 'longitude');
    const regionRole = bundle.mappings.find((m) => m.roleId === 'region');
    const categoryRole = bundle.mappings.find((m) => m.roleId === 'category');
    const valueRole = bundle.mappings.find((m) => m.roleId === 'metric_value');
    const addressRole = bundle.mappings.find((m) => m.roleId === 'address');

    if (!nameRole || !latRole || !lonRole) {
      return null;
    }

    const points: GeoPoint[] = [];
    const regions = new Set<string>();

    for (const row of bundle.source.parsedData) {
      const name = String(row[nameRole.sourceColumn] ?? '');
      const lat = Number(row[latRole.sourceColumn] ?? 0);
      const lon = Number(row[lonRole.sourceColumn] ?? 0);
      const region = regionRole ? String(row[regionRole.sourceColumn] ?? 'Unknown') : 'Unknown';
      const category = categoryRole ? String(row[categoryRole.sourceColumn] ?? 'Standard') : 'Standard';
      const value = valueRole ? Number(row[valueRole.sourceColumn] ?? 0) : 0;
      const address = addressRole ? String(row[addressRole.sourceColumn] ?? '') : '';

      if (name && lat !== 0 && lon !== 0) {
        points.push({
          id: `${name}-${lat}-${lon}`,
          name,
          lat,
          lon,
          region,
          category,
          value,
          address,
        });
        regions.add(region);
      }
    }

    return { points, regions: Array.from(regions) };
  }, [bundle]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (!geoData) return null;

    const allLats = [...geoData.points.map((p) => p.lat), ...REFERENCE_CITIES.map((c) => c.lat)];
    const allLons = [...geoData.points.map((p) => p.lon), ...REFERENCE_CITIES.map((c) => c.lon)];

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLon = Math.min(...allLons);
    const maxLon = Math.max(...allLons);

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1;
    const lonPadding = (maxLon - minLon) * 0.1;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding,
    };
  }, [geoData]);

  // Projection scales
  const { xScale, yScale } = useMemo(() => {
    if (!bounds) return { xScale: null, yScale: null };

    const width = 1400;
    const height = 800;
    const margin = { top: 60, right: 100, bottom: 60, left: 100 };

    const xScale = d3
      .scaleLinear()
      .domain([bounds.minLon, bounds.maxLon])
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([bounds.minLat, bounds.maxLat])
      .range([height - margin.bottom, margin.top]); // Inverted for lat

    return { xScale, yScale };
  }, [bounds]);

  // Value scale for circle sizes
  const valueScale = useMemo(() => {
    if (!geoData) return null;
    const values = geoData.points.map((p) => p.value || 0).filter((v) => v > 0);
    if (values.length === 0) return null;
    return d3.scaleSqrt().domain([0, Math.max(...values)]).range([4, 20]);
  }, [geoData]);

  // Category colors
  const categoryColors: Record<string, string> = {
    Flagship: '#10b981',
    Standard: '#3b82f6',
    Unknown: '#6b7280',
  };

  // Filtered points
  const filteredPoints = useMemo(() => {
    if (!geoData) return [];
    if (selectedRegions.size === 0) return geoData.points;
    return geoData.points.filter((p) => selectedRegions.has(p.region || 'Unknown'));
  }, [geoData, selectedRegions]);

  // Zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));

    return () => {
      svg.on('.zoom', null);
    };
  }, [geoData]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 8]);

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.5 : 0.67);
    }
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  if (!geoData || !xScale || !yScale) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">
          No geographic data available. Ensure location_name, latitude, and longitude columns are mapped.
        </p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  const { regions } = geoData;
  const width = 1400;
  const height = 800;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Geographic Map</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {filteredPoints.length} locations
          </Badge>
          <Button
            size="sm"
            variant={showReferenceCities ? 'default' : 'outline'}
            onClick={() => setShowReferenceCities(!showReferenceCities)}
            className="h-7 px-2 text-xs"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Reference Cities
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode('grid')}
            className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
          >
            <Eye className="w-3.5 h-3.5" />
            View Data
          </Button>
        </div>
      </div>

      {/* Region Filters */}
      <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Regions:</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedRegions(new Set())}
          className="h-6 px-2 text-xs"
        >
          All
        </Button>
        {regions.map((region) => (
          <Button
            key={region}
            size="sm"
            variant={selectedRegions.size === 0 || selectedRegions.has(region) ? 'default' : 'outline'}
            onClick={() => toggleRegion(region)}
            className="h-6 px-2 text-xs"
          >
            {region}
          </Button>
        ))}
      </div>

      {/* Visualization Area */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex gap-1 z-10">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('in')}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('out')}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('reset')}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-full overflow-auto p-4">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="cursor-grab active:cursor-grabbing"
          >
            <g ref={gRef}>
              {/* Grid lines for reference */}
              <g opacity={0.15}>
                {xScale.ticks(10).map((lon) => (
                  <line
                    key={`vline-${lon}`}
                    x1={xScale(lon)}
                    y1={yScale(bounds!.maxLat)}
                    x2={xScale(lon)}
                    y2={yScale(bounds!.minLat)}
                    stroke="#52525b"
                    strokeWidth={1}
                  />
                ))}
                {yScale.ticks(8).map((lat) => (
                  <line
                    key={`hline-${lat}`}
                    x1={xScale(bounds!.minLon)}
                    y1={yScale(lat)}
                    x2={xScale(bounds!.maxLon)}
                    y2={yScale(lat)}
                    stroke="#52525b"
                    strokeWidth={1}
                  />
                ))}
              </g>

              {/* Cardinal directions */}
              <g>
                <text
                  x={width / 2}
                  y={40}
                  textAnchor="middle"
                  className="text-lg fill-zinc-500 font-bold"
                  style={{ fontFamily: 'system-ui' }}
                >
                  N
                </text>
                <text
                  x={width / 2}
                  y={height - 20}
                  textAnchor="middle"
                  className="text-lg fill-zinc-500 font-bold"
                  style={{ fontFamily: 'system-ui' }}
                >
                  S
                </text>
                <text
                  x={40}
                  y={height / 2}
                  textAnchor="middle"
                  className="text-lg fill-zinc-500 font-bold"
                  style={{ fontFamily: 'system-ui' }}
                >
                  W
                </text>
                <text
                  x={width - 40}
                  y={height / 2}
                  textAnchor="middle"
                  className="text-lg fill-zinc-500 font-bold"
                  style={{ fontFamily: 'system-ui' }}
                >
                  E
                </text>
              </g>

              {/* Reference cities (if enabled) */}
              {showReferenceCities &&
                REFERENCE_CITIES.map((city) => {
                  const cx = xScale(city.lon);
                  const cy = yScale(city.lat);
                  return (
                    <g key={city.name}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="#71717a"
                        opacity={0.5}
                      />
                      <text
                        x={cx + 6}
                        y={cy + 3}
                        className="text-xs fill-zinc-600 select-none"
                        style={{ fontFamily: 'system-ui', fontStyle: 'italic' }}
                      >
                        {city.name}
                      </text>
                    </g>
                  );
                })}

              {/* Data points */}
              {filteredPoints.map((point) => {
                const cx = xScale(point.lon);
                const cy = yScale(point.lat);
                const isHovered = hoveredPoint?.id === point.id;
                const radius = valueScale && point.value ? valueScale(point.value) : 8;
                const color = categoryColors[point.category || 'Unknown'] || categoryColors.Unknown;

                return (
                  <g
                    key={point.id}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={color}
                      fillOpacity={isHovered ? 0.9 : 0.7}
                      stroke={isHovered ? '#fff' : color}
                      strokeWidth={isHovered ? 3 : 1.5}
                      className="transition-all duration-150"
                    />
                    {isHovered && (
                      <text
                        x={cx}
                        y={cy - radius - 8}
                        textAnchor="middle"
                        className="text-sm fill-zinc-200 font-semibold select-none"
                        style={{ fontFamily: 'system-ui', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                      >
                        {point.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Scale indicator */}
              <g transform={`translate(${width - 200}, ${height - 100})`}>
                <text className="text-xs fill-zinc-500 mb-2" y={-10} style={{ fontFamily: 'system-ui' }}>
                  Scale Reference
                </text>
                <line x1={0} y1={0} x2={100} y2={0} stroke="#52525b" strokeWidth={2} />
                <line x1={0} y1={-5} x2={0} y2={5} stroke="#52525b" strokeWidth={2} />
                <line x1={100} y1={-5} x2={100} y2={5} stroke="#52525b" strokeWidth={2} />
                <text x={50} y={20} textAnchor="middle" className="text-xs fill-zinc-500" style={{ fontFamily: 'system-ui' }}>
                  ~{Math.round(Math.abs(xScale.invert(100) - xScale.invert(0)))}° longitude
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* Point Detail Panel */}
        {hoveredPoint && (
          <div className="absolute bottom-4 right-4 w-80 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            <h3 className="font-semibold text-zinc-100 mb-1">{hoveredPoint.name}</h3>
            <div className="flex items-center gap-2 mb-3">
              {hoveredPoint.region && (
                <Badge variant="secondary" className="text-xs bg-zinc-800">
                  {hoveredPoint.region}
                </Badge>
              )}
              {hoveredPoint.category && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: categoryColors[hoveredPoint.category] || categoryColors.Unknown,
                    color: '#fff',
                  }}
                >
                  {hoveredPoint.category}
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-zinc-500">Coordinates:</span>{' '}
                <span className="text-zinc-200 font-mono text-xs">
                  {hoveredPoint.lat.toFixed(4)}, {hoveredPoint.lon.toFixed(4)}
                </span>
              </div>
              {hoveredPoint.value && hoveredPoint.value > 0 && (
                <div>
                  <span className="text-zinc-500">Value:</span>{' '}
                  <span className="text-emerald-400 font-bold">
                    ${(hoveredPoint.value / 1000000).toFixed(2)}M
                  </span>
                </div>
              )}
              {hoveredPoint.address && (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-400">{hoveredPoint.address}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 w-48 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <div className="text-xs font-medium text-zinc-300 mb-2">Categories</div>
          {Object.entries(categoryColors).map(([category, color]) => (
            <div key={category} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-zinc-400">{category}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
