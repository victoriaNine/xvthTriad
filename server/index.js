require('dotenv').config();
import { buildCardsImgLoader, buildFlagsImgLoader } from './buildImgLoaders';

Promise.all([ buildCardsImgLoader(), buildFlagsImgLoader() ]).then(() => {
  require('./startServer').default();
}).catch((err) => {
  console.error(err);
});
