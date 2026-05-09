import React, { ReactNode, ErrorInfo } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface ErrorBoundaryWrapperProps {
  showDetails?: boolean;
  children: ReactNode;
}

interface ErrorBoundaryProps extends ErrorBoundaryWrapperProps {
  t: (key: string, fallback?: string) => string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Wrapper component to use hooks with class component
function ErrorBoundaryWrapper(props: ErrorBoundaryWrapperProps): React.ReactElement {
  const { tString } = useTranslation();
  return <ErrorBoundary {...props} t={tString} />;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Story Mode Error:', error, errorInfo);
    this.setState({ error });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { showDetails, children, t } = this.props;

    if (!hasError) return children;

    return (
      <div className="error-boundary">
        <h2>{t('errors.somethingWentWrong')}</h2>
        <button
          onClick={() => window.location.reload()}
          className="retry-button"
        >
          {t('errors.retry')}
        </button>
        {showDetails && (
          <details className="error-details">
            <summary>{t('errors.errorDetails')}</summary>
            <pre>{error?.toString()}</pre>
          </details>
        )}
      </div>
    );
  }
}

export default ErrorBoundaryWrapper;