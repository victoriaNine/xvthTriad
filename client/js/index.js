import 'isomorphic-fetch';
import 'babel-polyfill';
import { template, some } from 'lodash';

import env from './internal/env';
import supportedBrowsers from './data/supportedBrowsers.json';
import appTemplate from './pages/app.ejs';
import maintenanceTemplate from './pages/maintenance.ejs';
import browserNoSupportTemplate from './pages/browserNoSupport.ejs';

import './../css/main.scss';

const isBrowserNotSupported = !some(supportedBrowsers.map((browser) => {
  let browserRegex = new RegExp(browser.name, "i");
  let nameCheck    = !!(env.browser.name.match(browserRegex));
  let versionCheck = browser.version ? checkVersion(browser.version) : true;

  return nameCheck && versionCheck;
}));

function checkVersion (query) {
  let checkSymbol = query.match(/[^\d\s]*/);
  checkSymbol = checkSymbol && checkSymbol[0];

  let version = parseInt(query.match(/\d+/), 10);
  let targetVersion = parseInt(env.browser.major, 10);

  switch (checkSymbol) {
    case ">":
      return targetVersion > version;
    case "<":
      return targetVersion < version;
    case ">=":
      return targetVersion >= version;
    case "<=":
      return targetVersion <= version;
    case "!=":
      return targetVersion !== version;
    case "==":
    default:
      return targetVersion === version;
  }
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

if (!__IS_DEV__) {
  require('./internal/ga');
}

if (!__IS_MAINTENANCE__ && !isBrowserNotSupported) {
  if (!__IS_DEV__) {
    require('./internal/pwa');
  }
  require('./main');
}
