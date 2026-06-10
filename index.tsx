
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConductorPortal from './components/ConductorPortal';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const tokenMatch = window.location.pathname.match(/^\/movil\/([a-f0-9-]{36})$/i);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {tokenMatch ? <ConductorPortal token={tokenMatch[1]} /> : <App />}
  </React.StrictMode>
);
