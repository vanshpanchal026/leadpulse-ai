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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Lock,
} from 'lucide-react';
import { validateDraftQuality } from '../schema';
import { PreSendQualityResult } from '../types';

interface DraftEditorProps {
  message: string;
  originalMessage: string;
  businessName: string;
  leadId: string;
  isSaving: boolean;
  onSaveDraft: (newMessage: string) => Promise<void>;
  onDraftChange?: (newMessage: string) => void;
}

export function OutreachDraftEditor({
  message,
  originalMessage,
  businessName,
  leadId,
  isSaving,
  onSaveDraft,
  onDraftChange,
}: DraftEditorProps) {
  const [draftText, setDraftText] = useState(message);
  const [quality, setQuality] = useState<PreSendQualityResult>(() =>
    validateDraftQuality(message, businessName)
  );

  useEffect(() => {
    setDraftText(message);
    setQuality(validateDraftQuality(message, businessName));
  }, [message, businessName]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftText(val);
    const q = validateDraftQuality(val, businessName);
    setQuality(q);
    onDraftChange?.(val);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(draftText);
    toast.success('Outreach Draft Copied', {
      description: 'Copied to clipboard. Ready for manual dispatch.',
    });
  };

  const handleReset = () => {
    setDraftText(originalMessage);
    setQuality(validateDraftQuality(originalMessage, businessName));
    onDraftChange?.(originalMessage);
    toast.info('Draft Reset to Original');
  };

  const handleClear = () => {
    setDraftText('');
    setQuality(validateDraftQuality('', businessName));
    onDraftChange?.('');
  };

  const handleSave = async () => {
    try {
      await onSaveDraft(draftText);
      toast.success('Draft Saved & Revalidated', {
        description: 'Updated draft recorded. Status revalidated.',
      });
    } catch (err: any) {
      toast.error('Failed to Save Draft', {
        description: err.message || 'Could not save draft.',
      });
    }
  };

  const isDirty = draftText !== message;

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Outreach Draft Editor
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
            <span
              className={`font-medium ${
                quality.characterCount > 300 ? 'text-[hsl(var(--warning-fg))]' : 'text-foreground'
              }`}
            >
              {quality.characterCount} / 300 chars
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {quality.sentenceCount} {quality.sentenceCount === 1 ? 'sentence' : 'sentences'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <textarea
          value={draftText}
          onChange={handleTextChange}
          placeholder="Type personalized outreach message (2-3 sentences max)..."
          aria-label="Outreach draft message"
          rows={4}
          className="w-full p-3.5 rounded-md bg-background border border-input text-foreground font-sans text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-y"
        />

        {/* Pre-Send Quality Check Badge & Advisory Notice */}
        <div className="p-3 rounded-md border border-border/60 bg-muted/15 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Pre-send quality check</span>
              <span className="text-[9px] text-muted-foreground font-sans">(advisory)</span>
            </span>

            {quality.level === 'PASS' && (
              <Badge variant="success" className="gap-1 text-[9px] font-mono">
                <CheckCircle2 className="h-2.5 w-2.5" />
                PASS
              </Badge>
            )}
            {quality.level === 'WARNING' && (
              <Badge variant="warning" className="gap-1 text-[9px] font-mono">
                <AlertTriangle className="h-2.5 w-2.5" />
                WARNING
              </Badge>
            )}
            {quality.level === 'BLOCK' && (
              <Badge variant="destructive" className="gap-1 text-[9px] font-mono">
                <XCircle className="h-2.5 w-2.5" />
                BLOCK
              </Badge>
            )}
          </div>

          {/* Feedback details */}
          {quality.errors.length > 0 && (
            <div className="space-y-1 text-destructive text-[11px]">
              {quality.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {quality.warnings.length > 0 && (
            <div className="space-y-1 text-[hsl(var(--warning-fg))] text-[11px]">
              {quality.warnings.map((warn, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {quality.level === 'PASS' && (
            <p className="text-[11px] text-[hsl(var(--success-fg))] leading-tight">
              ✓ Complies with peer-to-peer anti-spam standards: concise, consultative, and zero banned agency buzzwords.
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/60 flex flex-wrap items-center justify-between gap-2.5 pt-3 pb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Draft
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={draftText === originalMessage}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!draftText}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || quality.level === 'BLOCK'}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
