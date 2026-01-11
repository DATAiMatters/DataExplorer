import { useMemo, useState } from 'react';
import { profileTabularData } from '@/lib/dataUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3, Hash, Type, Calendar, ToggleLeft, AlertCircle, Search } from 'lucide-react';
import type { DataBundle, SemanticSchema, TabularProfile } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

const typeIcons = {
  string: Type,
  number: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  mixed: AlertCircle,
};

const typeColors = {
  string: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  number: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  date: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  boolean: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  mixed: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function TabularExplorer({ bundle }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'nulls' | 'unique'>('name');

  const profiles = useMemo(() => {
    try {
      return profileTabularData(bundle.source, bundle.mappings);
    } catch (e) {
      console.error('Failed to profile data:', e);
      return [];
    }
  }, [bundle]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) => p.column.toLowerCase().includes(term) || p.displayName.toLowerCase().includes(term)
      );
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nulls':
          return b.nullCount - a.nullCount;
        case 'unique':
          return b.uniqueCount - a.uniqueCount;
        default:
          return a.column.localeCompare(b.column);
      }
    });
    return result;
  }, [profiles, searchTerm, sortBy]);

  const summary = useMemo(() => {
    const totalRows = bundle.source.parsedData.length;
    const totalColumns = bundle.source.columns.length;
    const mappedColumns = bundle.mappings.length;
    const columnsWithNulls = profiles.filter((p) => p.nullCount > 0).length;
    const avgCompleteness =
      profiles.length > 0
        ? profiles.reduce((acc, p) => acc + (p.totalCount - p.nullCount) / p.totalCount, 0) /
          profiles.length
        : 1;
    return { totalRows, totalColumns, mappedColumns, columnsWithNulls, avgCompleteness: Math.round(avgCompleteness * 100) };
  }, [bundle, profiles]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-zinc-400">Data Profile</span>
          </div>
          <div className="flex gap-4 text-sm">
            <div><span className="text-zinc-500">Rows: </span><span className="text-zinc-200 font-medium">{summary.totalRows.toLocaleString()}</span></div>
            <div><span className="text-zinc-500">Columns: </span><span className="text-zinc-200 font-medium">{summary.totalColumns}</span></div>
            <div><span className="text-zinc-500">Mapped: </span><span className="text-zinc-200 font-medium">{summary.mappedColumns}</span></div>
            <div><span className="text-zinc-500">Completeness: </span><span className="text-emerald-400 font-medium">{summary.avgCompleteness}%</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div className="flex gap-1">
            {(['name', 'nulls', 'unique'] as const).map((s) => (
              <Button key={s} size="sm" variant={sortBy === s ? 'secondary' : 'ghost'} onClick={() => setSortBy(s)} className="h-8 text-xs capitalize">{s}</Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.map((profile) => (
            <ProfileCard key={profile.column} profile={profile} totalRows={summary.totalRows} />
          ))}
        </div>
        {filteredProfiles.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No columns match your search</div>
        )}
      </ScrollArea>
    </div>
  );
}

function ProfileCard({ profile, totalRows }: { profile: TabularProfile; totalRows: number }) {
  const Icon = typeIcons[profile.dataType];
  const colorClass = typeColors[profile.dataType];
  const completeness = Math.round(((totalRows - profile.nullCount) / totalRows) * 100);
  const uniqueness = Math.round((profile.uniqueCount / totalRows) * 100);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">{profile.displayName}</CardTitle>
            <p className="text-xs text-zinc-500 font-mono truncate">{profile.column}</p>
          </div>
          <Badge variant="outline" className={`ml-2 shrink-0 ${colorClass}`}>
            <Icon className="w-3 h-3 mr-1" />
            {profile.dataType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-semibold text-zinc-200">{profile.totalCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-semibold text-zinc-200">{profile.uniqueCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Unique</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className={`text-lg font-semibold ${profile.nullCount > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>{profile.nullCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Nulls</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Completeness</span>
            <span className={completeness < 80 ? 'text-amber-400' : 'text-emerald-400'}>{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Uniqueness</span>
            <span className="text-zinc-400">{uniqueness}%</span>
          </div>
          <Progress value={uniqueness} className="h-1.5" />
        </div>

        {profile.numericStats && (
          <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between"><span className="text-zinc-500">Min</span><span className="text-zinc-300">{profile.numericStats.min.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Max</span><span className="text-zinc-300">{profile.numericStats.max.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Mean</span><span className="text-zinc-300">{profile.numericStats.mean.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Median</span><span className="text-zinc-300">{profile.numericStats.median.toLocaleString()}</span></div>
          </div>
        )}

        {profile.topValues && profile.topValues.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-xs text-zinc-500 mb-2">Top Values</div>
            <div className="space-y-1">
              {profile.topValues.slice(0, 5).map((tv, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 truncate text-zinc-300">{tv.value}</div>
                  <div className="text-zinc-500">{tv.count}</div>
                  <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(tv.count / totalRows) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
