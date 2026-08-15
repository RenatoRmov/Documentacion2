
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConductorPortal from './components/ConductorPortal';
import PortalLogin from './components/PortalLogin';
import OnboardingForm from './components/OnboardingForm';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Compatibilidad con links antiguos basados en token
const pathToken  = window.location.pathname.match(/^\/movil\/([a-f0-9-]{36})$/i)?.[1];
const queryToken = window.location.pathname === '/portal'
  ? new URLSearchParams(window.location.search).get('token') ?? undefined
  : undefined;
const portalToken = pathToken ?? queryToken;

// /portal sin token → login por RUT
const isPortalRoute = !!pathToken || window.location.pathname === '/portal';

// /nuevo?token=xxx → alta de móvil nuevo (link de un solo uso generado por el admin)
const onboardingToken = window.location.pathname === '/nuevo'
  ? new URLSearchParams(window.location.search).get('token') ?? undefined
  : undefined;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {onboardingToken
      ? <OnboardingForm token={onboardingToken} />
      : portalToken
      ? <ConductorPortal token={portalToken} />
      : isPortalRoute
      ? <PortalLogin />
      : <App />}
  </React.StrictMode>
);
