require('dotenv').config();
import { buildCardList } from './buildCardList';

Promise.all([ buildCardList() ]).then(() => {
  require('./startServer').default();
}).catch((err) => {
  console.error(err);
});
