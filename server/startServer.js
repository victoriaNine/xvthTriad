import express from 'express';
import http from 'http';
import bodyParser from 'body-parser';
import SuperLogin from 'superlogin';
import PouchDB from 'pouchdb';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackConfig from './../webpack.config.js';

import setupCronJobs, { cronJobs } from './setupCronJobs';
import setupSockets from './setupSockets';

const protocol = process.env.NODE_ENV === "prod" ? "https://" : "http://";
const db = new PouchDB(protocol + process.env.DB_USER + ":" + process.env.DB_PASS + "@" + process.env.DB_HOST + "/users");

export default function startServer () {
  const PORT     = 9000;
  const app      = express();
  const compiler = webpack(webpackConfig);

  app.set("port", PORT);

  // Setup SuperLogin
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  const superloginConfig = {
    dbServer: {
      protocol,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      userDB: "users",
      couchAuthDB: "_users"
    },
    emails: {
      confirmMail: {
        template : "",
        subject : "",
        format: "html"
      }
    },
    mailer: {
      fromEmail: process.env.MAILER_NAME + " <" + process.env.MAILER_EMAIL + ">",
      options: "smtps://" + encodeURIComponent(process.env.MAILER_EMAIL) + ":" + process.env.MAILER_PASSWORD + "@" + process.env.MAILER_SMTP
    },
    security: {
      maxFailedLogins: 3,
      lockoutTime: 600,
      tokenLife: 24 * 60 * 60,
      sessionLife: 30 * 60,
      loginOnRegistration: false
    },
    local: {
      sendConfirmEmail: true,
      requireEmailConfirm: true,
      confirmEmailRedirectURL: "/confirm-email"
    },
    providers: {
      local: true
    }
  };

  // Initialize SuperLogin
  const superlogin = new SuperLogin(superloginConfig);

  // Mount SuperLogin's routes to our app
  app.use("/auth", superlogin.router);

  // Add Webpack
  app.use(webpackDevMiddleware(compiler));

  // Create node.js http server and listen on port
  const server = http.createServer(app);
  server.listen(app.get("port"), () => {
    console.log("Server listening on port", app.get("port"));
    setupCronJobs(db);
    setupSockets(server, db, cronJobs);
  });
}
