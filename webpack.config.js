const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    content: './src/content.js', 
    background: './src/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  devtool: 'inline-source-map',  // This line ensures source maps are generated
   module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/panel.html', to: 'panel.html' },
        { from: 'src/quickstart.html', to: 'quickstart.html' },
        { from: 'src/externalScript.js', to: 'externalScript.js' },
        { from: 'src/style.css', to: 'style.css' },
        { from: 'src/settings.js', to: 'settings.js' }, 
        { from: 'icons', to: 'icons' }, 
        { from: 'src/tagManagement.js', to: 'tagManagement.js' },
        { from: 'src/taskManagement.js', to: 'taskManagement.js' },
        { from: 'src/panel.js', to: 'panel.js' },
        { from: 'src/generalTags.js', to: 'generalTags.js' }
    
      ],
    }),
  ],
};
