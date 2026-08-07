import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { info, warn, error } from '@tauri-apps/plugin-log';

if ('__TAURI_INTERNALS__' in window) {
  const fmt = (a: any[]) => a.map(x => (typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(' ');
  console.log = (...a) => { info(fmt(a)); };
  console.info = (...a) => { info(fmt(a)); };
  console.warn = (...a) => { warn(fmt(a)); };
  console.error = (...a) => { error(fmt(a)); };
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);