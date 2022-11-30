const path = require('path');

module.exports = {
  entry: './src/app.js',
  mode: 'none',
  target: 'node',
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2', 
    clean: true
  },
};