import { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Edit2, Check, X, Calendar, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { JournalEntry } from '@/types';

export function Journal() {
  const journalEntries = useAppStore((s) => s.journalEntries);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const updateJournalEntry = useAppStore((s) => s.updateJournalEntry);
  const deleteJournalEntry = useAppStore((s) => s.deleteJournalEntry);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', tags: '' });
  const [editForm, setEditForm] = useState({ title: '', content: '', tags: '' });

  const handleCreate = () => {
    if (!newEntry.title.trim()) return;

    const entry: JournalEntry = {
      id: `journal-${Date.now()}`,
      title: newEntry.title.trim(),
      content: newEntry.content.trim(),
      tags: newEntry.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addJournalEntry(entry);
    setNewEntry({ title: '', content: '', tags: '' });
    setIsCreating(false);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      content: entry.content,
      tags: entry.tags?.join(', ') || '',
    });
  };

  const handleUpdate = () => {
    if (!editingId || !editForm.title.trim()) return;

    updateJournalEntry(editingId, {
      title: editForm.title.trim(),
      content: editForm.content.trim(),
      tags: editForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });

    setEditingId(null);
    setEditForm({ title: '', content: '', tags: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this journal entry?')) {
      deleteJournalEntry(id);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedEntries = [...journalEntries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Journal</h1>
          <p className="text-zinc-400 mt-1">
            Keep notes and thoughts about your data exploration
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {isCreating && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <Input
                  placeholder="Entry title..."
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-lg font-semibold"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="What's on your mind?"
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 min-h-[200px] resize-none"
                />
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder="Tags (comma-separated)"
                    value={newEntry.tags}
                    onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!newEntry.title.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsCreating(false);
                      setNewEntry({ title: '', content: '', tags: '' });
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {sortedEntries.length === 0 && !isCreating && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="py-12 text-center">
                <p className="text-zinc-400">
                  No journal entries yet. Create your first entry to get started.
                </p>
              </CardContent>
            </Card>
          )}

          {sortedEntries.map((entry) => (
            <Card key={entry.id} className="bg-zinc-900 border-zinc-800">
              {editingId === entry.id ? (
                <>
                  <CardHeader>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-lg font-semibold"
                    />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 min-h-[200px] resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-zinc-400" />
                      <Input
                        placeholder="Tags (comma-separated)"
                        value={editForm.tags}
                        onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdate}
                        disabled={!editForm.title.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm({ title: '', content: '', tags: '' });
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-zinc-100">{entry.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-2">
                          <Calendar className="w-3 h-3" />
                          {formatDate(entry.updatedAt)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entry)}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entry.id)}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {entry.content && (
                      <div className="text-zinc-300 whitespace-pre-wrap">{entry.content}</div>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.tags.map((tag, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-zinc-800 text-zinc-300"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
