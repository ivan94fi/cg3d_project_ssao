const path = require('path');

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
            }
        ]
    }
};
