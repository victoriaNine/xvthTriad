import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import path from 'path';

const ENV = process.env.NODE_ENV || 'development';
const CSS_MAPS = ENV!=='production';

module.exports = {
	context: path.resolve(__dirname, "./app"),
  entry: './main.js',

  output: {
    path: path.resolve(__dirname, "./dist"),
    publicPath: '/',
    filename: 'bundle.js'
  },

	resolve: {
		alias: {
			jquery            : "libs/jquery/dist/jquery",
			backbone          : "libs/backbone/backbone",
			underscore        : "libs/lodash/dist/lodash",
			tweenMax          : "libs/gsap/src/uncompressed/TweenMax",
			seriously         : "libs/seriouslyjs/seriously",
			modernizr         : "libs/modernizr/modernizr",
			socketIO          : "libs/socket.io-client/dist/socket.io",
			stats             : "libs/stats.js/build/stats",
			superlogin        : "libs/superlogin-client/superlogin",
			elo               : "libs/elo/elo",

			text              : "libs/requirejs-plugins/lib/text",
			async             : "libs/requirejs-plugins/src/async",
			font              : "libs/requirejs-plugins/src/font",
			goog              : "libs/requirejs-plugins/src/goog",
			image             : "libs/requirejs-plugins/src/image",
			json              : "libs/requirejs-plugins/src/json",
			noext             : "libs/requirejs-plugins/src/noext",
			mdown             : "libs/requirejs-plugins/src/mdown",
			propertyParser    : "libs/requirejs-plugins/src/propertyParser",
			markdownConverter : "libs/requirejs-plugins/lib/Markdown.Converter",

			jqueryNearest     : "libs/jquery-nearest/src/jquery.nearest",
			es6Promise        : "libs/es6-promise/es6-promise",
			fetch             : "libs/fetch/fetch",
			storage           : "libs/backbone/backbone.localStorage",
			jsonPrune         : "libs/jsonPrune/json.prune",
			axios             : "libs/axios/dist/axios",
			eventemitter2     : "libs/eventemitter2/lib/eventemitter2",
			tablesortNumber   : "libs/tablesort/tablesort.number",

			global            : "global"
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
        include: [path.resolve(__dirname, 'app/js/views/main.js')],
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader',
              options: { modules: true, sourceMap: CSS_MAPS, importLoaders: 1 }
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
			,
      {
        test: /\.json$/,
        use: 'json-loader'
      },
      {
        test: /\.(xml|html|txt|md)$/,
        use: 'raw-loader'
      },
      {
        test: /\.(svg|woff2?|ttf|eot|jpe?g|png|gif|mp4|pdf)(\?.*)?$/i,
        use: ENV==='production' ? 'file-loader' : 'url-loader'
      },
    ]
  },
	plugins: [
      new webpack.optimize.UglifyJsPlugin({minimize: true})
  ]
};
