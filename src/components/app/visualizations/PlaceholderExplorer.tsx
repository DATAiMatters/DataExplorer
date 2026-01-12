import { Construction } from 'lucide-react';
import type { DataBundle } from '@/types';

interface Props {
  bundle: DataBundle;
  schemaName: string;
}

export function PlaceholderExplorer({ bundle, schemaName }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-amber-400" />
      </div>
      <h2 className="text-2xl font-semibold text-zinc-200 mb-2">
        {schemaName} Visualization Coming Soon
      </h2>
      <p className="text-zinc-400 max-w-md mb-6">
        The dedicated visualization for <span className="text-zinc-200">{schemaName}</span> data is currently under development.
        Your data has been successfully loaded and can be explored using the data preview below.
      </p>

      {/* Data Preview */}
      <div className="w-full max-w-4xl bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-200">
            Data Preview ({bundle.source.parsedData.length} records)
          </h3>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/30 sticky top-0">
              <tr>
                {bundle.source.columns.slice(0, 8).map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-medium text-zinc-400 border-b border-zinc-700"
                  >
                    {col}
                  </th>
                ))}
                {bundle.source.columns.length > 8 && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400 border-b border-zinc-700">
                    ...
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {bundle.source.parsedData.slice(0, 20).map((row, idx) => (
                <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  {bundle.source.columns.slice(0, 8).map((col) => (
                    <td key={col} className="px-4 py-2 text-zinc-300">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                  {bundle.source.columns.length > 8 && (
                    <td className="px-4 py-2 text-zinc-500">...</td>
                  )}
                </tr>
              ))}
              {bundle.source.parsedData.length > 20 && (
                <tr>
                  <td
                    colSpan={Math.min(bundle.source.columns.length, 9)}
                    className="px-4 py-3 text-center text-xs text-zinc-500"
                  >
                    Showing first 20 of {bundle.source.parsedData.length} records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-xs text-zinc-500">
        <p>In the meantime, your data is safely stored and ready for visualization.</p>
      </div>
    </div>
  );
}
