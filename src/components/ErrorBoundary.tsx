import { getMessage } from '../tools/i18n';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      error.message,
      error.stack,
      errorInfo.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary" role="alert">
          <p className="error-boundary__message">
            {getMessage('OV_FL_ERROR') || 'An error occurred'}
          </p>
          {this.state.error && (
            <details className="error-boundary__details">
              <summary>{getMessage('errorDetails') || 'Details'}</summary>
              <pre>{this.state.error.message}</pre>
            </details>
          )}
          <button className="error-boundary__retry" onClick={this.handleRetry} type="button">
            {getMessage('errorRetry') || 'Retry'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
