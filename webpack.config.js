const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      content: './src/content.js', 
      background: './src/background.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
    },
    devtool: isProduction ? false : 'inline-source-map',
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
};
