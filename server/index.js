require('dotenv').config();

/*process.on("uncaughtException", (error) => {
  console.trace(JSON.stringify(error));
  console.trace(JSON.stringify(error.stack));
});*/

import PouchDB from 'pouchdb';

import { buildCardsImgLoader, buildFlagsImgLoader } from './buildImgLoaders';
import startServer from './startServer';

const protocol = process.env.NODE_ENV === "prod" ? "https://" : "http://";
const db = new PouchDB(protocol + process.env.DB_USER + ":" + process.env.DB_PASS + "@" + process.env.DB_HOST + "/users");

Promise.all([ buildCardsImgLoader(), buildFlagsImgLoader() ]).then(() => {
  startServer(db, protocol);
}).catch((err) => {
  console.error(err);
});
