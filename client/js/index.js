import 'isomorphic-fetch';
import 'babel-polyfill';

import './../css/main.scss';

if (!__IS_DEV__) {
  require('./pwa');
}

if (!__IS_MAINTENANCE__) {
  require('./main');
}
