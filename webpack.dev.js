const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './js/main.js',
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './dist',
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [{
            test: /\.(mtl|obj)$/,
            loader: 'file-loader'
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
            favicon: './resources/icon.png',
            inject: true,
            minify: {
                removeComments: true,
                collapseWhitespace: false
            }
        })
    ],
};
