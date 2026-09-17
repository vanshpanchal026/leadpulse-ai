import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground font-medium',
        solid:
          'border-transparent bg-primary text-primary-foreground font-medium shadow-xs',
        secondary:
          'border-border bg-secondary text-muted-foreground',
        destructive:
          'bg-[hsl(var(--destructive-bg))] text-destructive border-[hsl(var(--destructive-border))] border',
        outline: 'text-foreground border-border bg-transparent',
        success:
          'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))] border',
        warning:
          'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border-[hsl(var(--warning-border))] border',
        info:
          'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))] border',
        // Grounded Multi-Agent Evidence Classifications
        observed:
          'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))] border font-mono tracking-wide uppercase text-xs',
        inferred:
          'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border-[hsl(var(--warning-border))] border font-mono tracking-wide uppercase text-xs',
        unknown:
          'bg-secondary text-muted-foreground border-border border font-mono tracking-wide uppercase text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
