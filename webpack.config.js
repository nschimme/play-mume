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
        { from: 'DecafMUD', to: 'DecafMUD' }, // Copy entire DecafMUD directory
        { from: 'play.css', to: 'play.css' },
        { from: 'manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: 'sw.js', to: 'sw.js' }, // Service worker
        // Note on JavaScript dependencies:
        // External JavaScript libraries (like jQuery, PixiJS) and application-specific
        // JavaScript files (e.g., from DecafMUD/src/ SCRIPT_DIR or other subdirectories)
        // are expected to be imported into the webpack entry points (src/index.ts or src/map-loader.ts)
        // to be included in the output bundles (main.bundle.js, map.bundle.js).
        // HtmlWebpackPlugin automatically adds <script> tags for these bundles.
        // If any JavaScript files are simply copied to the 'dist' directory by CopyWebpackPlugin
        // without being part of a webpack bundle, HtmlWebpackPlugin will NOT add script tags for them,
        // and they will not be active in the application unless manually loaded, which is not the
        // recommended approach when using webpack.
        // This might be a subject for a future refactoring task if such dependencies are not currently bundled.
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
