import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-black text-zinc-100 mb-2">Something went wrong</h1>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            An unexpected error occurred. This has been logged and will be investigated.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 overflow-auto text-red-400 max-h-40">
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Reload App
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
