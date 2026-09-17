import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Edit3,
  Copy,
  RotateCcw,
  Trash2,
  Save,
  MessageSquare,
} from 'lucide-react';

interface DraftEditorProps {
  message: string;
  originalMessage: string;
  channel: string;
  businessName: string;
  leadId: string;
  isSaving?: boolean;
  onSaveDraft?: (newMessage: string) => Promise<void>;
  onDraftChange?: (newMessage: string) => void;
}

export function DraftEditor({
  message,
  originalMessage,
  channel,
  businessName,
  leadId,
  isSaving = false,
  onSaveDraft,
  onDraftChange,
}: DraftEditorProps) {
  const [draftText, setDraftText] = useState(message);

  useEffect(() => {
    setDraftText(message);
  }, [message]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftText(val);
    onDraftChange?.(val);
  };

  const handleCopy = () => {
    if (!draftText.trim()) {
      toast.error('Cannot copy an empty draft.');
      return;
    }
    navigator.clipboard?.writeText(draftText);
    toast.success('Outreach Draft Copied to Clipboard', {
      description: 'Ready for manual dispatch via WhatsApp Web or messaging client.',
    });
  };

  const handleReset = () => {
    setDraftText(originalMessage);
    onDraftChange?.(originalMessage);
    toast.info('Draft Reset to Original');
  };

  const handleClear = () => {
    setDraftText('');
    onDraftChange?.('');
  };

  const handleSave = async () => {
    if (!onSaveDraft) return;
    try {
      await onSaveDraft(draftText);
      toast.success('Draft Saved', {
        description: 'Updated draft recorded in workspace state.',
      });
    } catch (err: any) {
      toast.error('Failed to save draft', {
        description: err.message || 'Could not save draft.',
      });
    }
  };

  const isDirty = draftText !== message;
  const charCount = draftText.length;
  const sentenceMatches = draftText.trim().match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  const sentenceCount = sentenceMatches.length || (draftText.trim().length > 0 ? 1 : 0);

  return (
    <Card className="border-border bg-card shadow-xs font-sans">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Outreach Draft Editor
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono capitalize">
              {channel} Channel
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
            <span
              className={`font-medium ${
                charCount > 300
                  ? 'text-[hsl(var(--warning-fg))]'
                  : 'text-foreground'
              }`}
            >
              {charCount} / 300 chars
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {sentenceCount} {sentenceCount === 1 ? 'sentence' : 'sentences'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <textarea
          value={draftText}
          onChange={handleTextChange}
          placeholder="Type personalized consultative outreach message (2-3 sentences max)..."
          aria-label="Outreach draft text"
          rows={4}
          className="w-full p-3.5 rounded-md bg-background border border-input text-foreground font-sans text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-y transition-colors"
        />
      </CardContent>

      <CardFooter className="border-t border-border/60 flex flex-wrap items-center justify-between gap-3 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCopy}
            disabled={!draftText.trim()}
            className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Pitch
          </Button>

          {draftText !== originalMessage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Revert edits back to original AI draft"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && onSaveDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
