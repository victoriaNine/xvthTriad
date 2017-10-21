import 'isomorphic-fetch';
import 'babel-polyfill';
import { template } from 'lodash';

import appTemplate from './pages/app.ejs';
import maintenanceTemplate from './pages/maintenance.ejs';
import browserNoSupportTemplate from './pages/browserNoSupport.ejs';

import './../css/main.scss';

const isBrowserNotSupported = false;

if (!__IS_DEV__) {
  require('./internal/ga');
  require('./internal/pwa');
}

let title = document.title;
let bodyClasses = '';
let contents;
let currentTemplate;

if (__IS_MAINTENANCE__) {
  currentTemplate = maintenanceTemplate;
  title += ' -- Maintenance in progress';
  bodyClasses = 'maintenance';
} else if (isBrowserNotSupported) {
  currentTemplate = browserNoSupportTemplate;
  title += ' -- Browser not supported';
  bodyClasses = 'browserNoSupport';
} else {
  currentTemplate = appTemplate;
}

contents = template(currentTemplate)();
document.title = title;
bodyClasses && document.body.classList.add(bodyClasses);
document.body.innerHTML = contents;

if (!__IS_MAINTENANCE__ && !isBrowserNotSupported) {
  require('./main');
}
