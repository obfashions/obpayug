import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent-100 flex items-center justify-center">
              <i className="ri-error-warning-line text-3xl text-accent-500"></i>
            </div>
            <h2 className="text-xl font-semibold text-foreground-950 mb-2">
              Something went wrong
            </h2>
            <p className="text-foreground-600 mb-4">
              The app encountered an error. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-background-50 rounded-lg font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i>
              Reload Page
            </button>
            {this.state.error && (
              <div className="mt-6 p-4 bg-background-100 rounded-lg text-left overflow-auto">
                <p className="text-xs text-foreground-500 font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}