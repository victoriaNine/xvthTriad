import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import OfflinePlugin from 'offline-plugin';
import ImageminPlugin from 'imagemin-webpack-plugin';
import ResourceHintWebpackPlugin from 'resource-hints-webpack-plugin';
import path from 'path';

import packageConfig from './package.json';

const ENV = process.env.NODE_ENV || 'development';
const IS_DEV = ENV!=='production';
const IS_MAINTENANCE = process.env.MAINTENANCE;
const BASE_PATH = path.resolve(__dirname, "client/");

const config = {
  context: BASE_PATH,
  entry: './js/index.js',

  output: {
    path: path.resolve(__dirname, "dist/"),
    publicPath: '/',
    filename: 'bundle.js'
  },

  resolve: {
    extensions: ['.js', '.json', '.jpg', '.jpeg', '.png', '.gif', '.svg'],
    alias: {
      Assets: path.resolve(BASE_PATH, "assets/"),
      CSS: path.resolve(BASE_PATH, "css/"),

      Collections: path.resolve(BASE_PATH, "js/collections/"),
      Data: path.resolve(BASE_PATH, "js/data/"),
      Internal: path.resolve(BASE_PATH, "js/internal/"),
      Models: path.resolve(BASE_PATH, "js/models/"),
      Modules: path.resolve(BASE_PATH, "js/modules/"),
      Pages: path.resolve(BASE_PATH, "js/pages/"),
      Components: path.resolve(BASE_PATH, "js/views/components/"),
      Partials: path.resolve(BASE_PATH, "js/views/containers/partials/"),
      Screens: path.resolve(BASE_PATH, "js/views/containers/screens/"),

      utils$: path.resolve(BASE_PATH, "js/internal/utils.js"),
      env$: path.resolve(BASE_PATH, "js/internal/env.js"),
    }
  },

  module: {
    rules: [
      { test: /jqueryNearest/, loader: 'exports?jquery' },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.(css|sass|scss)$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader',
              options: {
                modules: false,
                sourceMap: IS_DEV,
                importLoaders: 1,
                minimize: !IS_DEV,
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: IS_DEV
              }
            },
            {
              loader: `sass-loader`,
              options: {
                sourceMap: IS_DEV
              }
            }
          ]
        })
      },
      {
        test: /\.json$/,
        use: 'json-loader'
      },
      {
        test: /\.(xml|html|txt|md|ejs)$/,
        use: 'raw-loader'
      },
      {
        test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif|mp4|pdf|ogg|mp3|wav)(\?.*)?$/i,
        use: 'file-loader'
      },
    ]
  },

  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
    new webpack.DefinePlugin({
      __APP_NAME__: JSON.stringify(packageConfig.name),
      __VERSION__: JSON.stringify(packageConfig.version),
      __VERSION_NAME__: JSON.stringify(packageConfig.versionName),
      __VERSION_FLAG__: JSON.stringify(packageConfig.versionFlag),
      __IS_DEV__: JSON.stringify(IS_DEV),
      __IS_MAINTENANCE__: JSON.stringify(IS_MAINTENANCE),
    }),
    new ExtractTextPlugin('style.css'),
    new HtmlWebpackPlugin({
      template: './index.html',
      minify: { collapseWhitespace: true }
    }),
    new ResourceHintWebpackPlugin(),
    new CopyWebpackPlugin([
      { from: './favicon.ico', to: './' },
      { from: './manifest.json', to: './' },
      { from: './robots.txt', to: './' },
      { from: './assets/img/icons/*', to: './' },
    ]),
  ].concat(!IS_DEV ? [
    new ImageminPlugin({
      test: /\.(jpe?g|png|gif|svg)$/i,
    }),

    new OfflinePlugin({
      safeToUseOptionalCaches: true,
      caches: {
        main: [
          'bundle.js',
          'style.css',
          'index.html'
        ],
        additional: [
          '*.jpg',
          '*.png',
          '*.svg',
          '*.gif'
        ],
        optional: [
          ':rest:'
        ]
      },
      AppCache: false,
      ServiceWorker: {
        events: true
      }
    }),

    new webpack.optimize.UglifyJsPlugin({
      uglifyOptions: {
        output: {
          comments: false
        },
        compress: {
          unsafe_comps: true,
          properties: true,
          keep_fargs: false,
          pure_getters: false,
          collapse_vars: true,
          unsafe: true,
          warnings: false,
          screw_ie8: true,
          sequences: true,
          dead_code: true,
          drop_debugger: true,
          comparisons: true,
          conditionals: true,
          evaluate: true,
          booleans: true,
          loops: true,
          unused: true,
          hoist_funs: true,
          if_return: true,
          join_vars: true,
          cascade: true,
          drop_console: true
        }
      }
    })
  ] : []),

  node: {
    fs: 'empty',
    global: true,
    crypto: 'empty',
    tls: 'empty',
    net: 'empty',
    process: true,
    module: false,
    clearImmediate: false,
    setImmediate: false
  },

  devtool: 'source-map',
};

export default config;
