const express = require('express');
const path = require('path');

const port = process.env.PORT || 8080;
const app = express();

const dist_dir = path.resolve(__dirname, "..", "dist");

app.use(express.static(dist_dir));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(dist_dir, 'index.html'));
});

app.listen(port, () => {
    console.log(`App listening to ${port}....`)
    console.log('Press Ctrl+C to quit.')
});
