// src/components/ErrorBoundary.tsx
import React from 'react';
import { Button, Icon } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Roam Copilot Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report to error tracking service if available
    if (window.location.hostname !== 'localhost') {
      try {
        // Here you could send to an error tracking service
        console.error('Error details:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        });
      } catch (reportError) {
        console.error('Failed to report error:', reportError);
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.handleReset} />;
      }

      return (
        <div style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          margin: '10px',
          textAlign: 'center'
        }}>
          <Icon icon={IconNames.ERROR} size={24} color="#ff6b6b" style={{ marginBottom: '10px' }} />
          <h3 style={{ color: '#d63031', marginBottom: '10px' }}>Something went wrong</h3>
          <p style={{ color: '#636e72', marginBottom: '15px' }}>
            Roam Copilot encountered an unexpected error. This has been logged for investigation.
          </p>
          <Button
            onClick={this.handleReset}
            intent="primary"
            text="Try Again"
            style={{ marginRight: '10px' }}
          />
          <Button
            onClick={() => window.location.reload()}
            text="Reload Page"
          />
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '15px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Development)
              </summary>
              <pre style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '10px', 
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Custom hook for error handling in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('Roam Copilot Error:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};