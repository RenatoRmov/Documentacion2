
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConductorPortal from './components/ConductorPortal';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const pathToken  = window.location.pathname.match(/^\/movil\/([a-f0-9-]{36})$/i)?.[1];
const queryToken = window.location.pathname === '/portal'
  ? new URLSearchParams(window.location.search).get('token') ?? undefined
  : undefined;
const portalToken = pathToken ?? queryToken;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {portalToken ? <ConductorPortal token={portalToken} /> : <App />}
  </React.StrictMode>
);
