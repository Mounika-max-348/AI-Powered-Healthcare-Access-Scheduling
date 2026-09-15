import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// In local dev the frontend and API share an origin (or a dev proxy), so
// relative "/api/..." calls just work. In a real deployment the frontend
// (a static site) and the API (a Node web service) usually live on two
// different URLs, so we point the API client at one explicitly when it's
// provided at build time.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
