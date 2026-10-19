import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import './styles.css';
import App from './App.jsx';

// The dashboard is loaded only on /admin, so visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

createRoot(document.getElementById('root')).render(
  isAdmin ? <Suspense fallback={null}><AdminApp /></Suspense> : <App />
);
