import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.99] active:translate-y-px',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.99] active:translate-y-px',
        outline:
          'border border-border bg-transparent hover:bg-secondary hover:border-border-strong text-foreground transition-[background-color,border-color,transform] duration-150 active:scale-[0.99] active:translate-y-px',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 transition-[background-color,transform] duration-150 active:scale-[0.99] active:translate-y-px',
        ghost: 'hover:bg-secondary hover:text-foreground text-foreground transition-colors duration-150 active:scale-[0.99] active:translate-y-px',
        link: 'text-primary underline-offset-4 hover:underline transition-colors duration-150',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 rounded-md px-2 text-xs',
        lg: 'h-9 rounded-md px-4 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
