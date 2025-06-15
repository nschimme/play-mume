const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // We can change this to 'production' for builds
  entry: {
    main: './src/index.ts', // Existing entry point
    map: './src/map-loader.ts', // New entry point for map.html
  },
  devtool: 'inline-source-map', // Good for development
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].bundle.js', // [name] will be 'main' or 'map'
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Clean the dist folder before each build
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['main'], // Only include the 'main' bundle
    }),
    new HtmlWebpackPlugin({
      template: './map.html',    // Use existing map.html as a template
      filename: 'map.html',      // Output as dist/map.html
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['map'],           // Only include the 'map' bundle
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'resources', to: 'resources' },
        { from: 'icons', to: 'icons' },
        { from: 'DecafMUD/src/css', to: 'DecafMUD/src/css' },
        // Add other static assets that need to be copied
        // Note: DecafMUD js files will be bundled if imported, or need to be copied if used as separate scripts
        // For now, let's assume we'll handle DecafMUD js via imports or copy them as needed later.
        // The original index.html loads many DecafMUD js files. These will need to be
        // either imported in the TypeScript entry point or copied and loaded if they can't be bundled.
        { from: 'DecafMUD/src/flash', to: 'DecafMUD/src/flash', globOptions: { ignore: ['**/README.md'] } }, // Example for flash
        { from: 'play.css', to: 'play.css' },
        { from: 'manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: 'sw.js', to: 'sw.js' }, // Service worker
      ],
    }),
  ],
  // If we need jQuery or other libraries to be globally available,
  // we can use the ProvidePlugin or configure externals.
  // For example, to make $ and jQuery available:
  // optimization: {
  //  splitChunks: {
  //    chunks: 'all',
  //  },
  // },
  // plugins: [
  //   new webpack.ProvidePlugin({
  //     $: 'jquery',
  //     jQuery: 'jquery',
  //   }),
  // ],
};
