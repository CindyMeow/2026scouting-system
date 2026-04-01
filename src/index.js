import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 這行會去 public/index.html 找 <div id="root"></div>
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// 將 unregister 改為 register
serviceWorkerRegistration.register();