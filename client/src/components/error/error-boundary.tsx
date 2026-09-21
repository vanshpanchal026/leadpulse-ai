import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertOctagon, RefreshCw, Home, ChevronDown, ChevronUp, Bug } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * Class-based Error Boundary for catching rendering exceptions in component subtrees.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary${this.props.componentName ? ` - ${this.props.componentName}` : ''}] caught:`, error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error || new Error('Unknown error'), this.resetError);
        }
        return this.props.fallback;
      }

      return (
        <div className="p-6 max-w-2xl mx-auto my-8">
          <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10 shadow-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                    <AlertOctagon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-foreground font-semibold">
                      Component Execution Error
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {this.props.componentName ? `Failed inside <${this.props.componentName}>` : 'An unexpected exception occurred while rendering this view.'}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="destructive" className="font-mono text-[10px]">
                  Uncaught Exception
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-md border border-border/80 text-xs font-mono text-destructive break-all">
                {this.state.error?.message || 'Unknown runtime error occurred.'}
              </div>

              <div>
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                >
                  <Bug className="h-3 w-3" />
                  <span>{this.state.showDetails ? 'Hide Stack Trace' : 'Show Diagnostic Trace'}</span>
                  {this.state.showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {this.state.showDetails && this.state.error?.stack && (
                  <pre className="mt-2 p-3 bg-muted/60 text-foreground text-[10px] font-mono rounded-md overflow-x-auto max-h-48 border border-border/80">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-[10px] text-muted-foreground font-mono">
                Safety Invariant: external_send_executed = false
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="h-8 gap-1.5 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  Reload Window
                </Button>
                <Button size="sm" onClick={this.resetError} className="h-8 gap-1.5 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Route-level Error Boundary for React Router createBrowserRouter.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const [showStack, setShowStack] = React.useState(false);

  let errorMessage = 'An unexpected routing error occurred.';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const stack = error instanceof Error ? error.stack : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full border-border/80 bg-card shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-semibold [font-family:var(--font-display)] text-foreground">
            {errorStatus === 404 ? '404 — Page Not Found' : 'Application Route Error'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            The requested view encountered a failure during lifecycle resolution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="p-3 rounded-md bg-muted/60 border border-border text-xs font-mono text-foreground break-all">
            {errorMessage}
          </div>

          {stack && (
            <div>
              <button
                type="button"
                onClick={() => setShowStack(!showStack)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono"
              >
                <Bug className="h-3 w-3" />
                <span>{showStack ? 'Hide Stack' : 'View Stack'}</span>
                {showStack ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {showStack && (
                <pre className="mt-2 p-3 bg-slate-950 text-slate-200 text-[10px] font-mono rounded overflow-x-auto max-h-48 border border-slate-800">
                  {stack}
                </pre>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-border pt-3">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link to="/">
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.location.reload()} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
