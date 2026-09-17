import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-zinc-100 group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg text-xs font-sans',
          description: 'group-[.toast]:text-zinc-400 text-[11px]',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs',
          cancelButton:
            'group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 text-xs',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
