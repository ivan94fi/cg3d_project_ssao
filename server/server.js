const express = require('express');
const path = require('path');
const portfinder = require('portfinder');

portfinder.getPort((err, port) => {
    if (err) {
        console.error('Unable to find open port. Exiting.');
        return;
    }
    start_app(port);
});

function start_app(port) {
    const app = express();

    const dist_dir = path.resolve(__dirname, '..', 'dist');

    app.use(express.static(dist_dir));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(dist_dir, 'index.html'));
    });

    app.listen(port, () => {
        console.log(`App listening to ${port}....`);
        console.log('Press Ctrl+C to quit.');
    });
}
