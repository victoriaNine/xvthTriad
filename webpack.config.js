import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';

const ENV = process.env.NODE_ENV || 'development';
const CSS_MAPS = ENV!=='production';
const BASE_PATH = path.resolve(__dirname, "app/");

const config = {
  context: BASE_PATH,
  entry: './js/main.js',

  output: {
    path: path.resolve(__dirname, "dist/"),
    publicPath: '/',
    filename: 'bundle.js'
  },

  resolve: {
    alias: {
      seriously$: path.resolve(BASE_PATH, "js/modules/seriouslyjs/seriously.js"),
      store$: path.resolve(BASE_PATH, "js/store.js"),
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
              options: { modules: false, sourceMap: CSS_MAPS, importLoaders: 1 }
            },
            {
              loader: `sass-loader`,
              options: {
                sourceMap: CSS_MAPS
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
        test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif|mp4|pdf)(\?.*)?$/i,
        use: ENV==='production' ? 'file-loader' : 'url-loader'
      },
    ]
  },

  plugins: [
    new webpack.optimize.UglifyJsPlugin({minimize: true}),
    new ExtractTextPlugin('style.css'),
    new HtmlWebpackPlugin({
      template: './index.ejs',
      minify: { collapseWhitespace: true }
    })/*,
    new CopyWebpackPlugin([
      { from: './manifest.json', to: './' },
      { from: './favicon.ico', to: './' }
    ])*/
  ],

  node: {
    fs: 'empty',
    child_process: 'empty',
    package: 'empty',
    tls: 'empty',
    generate: 'empty'
  },
};

export default config;
