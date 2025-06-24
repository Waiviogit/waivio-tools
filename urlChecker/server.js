const express = require('express');
const path = require('path');
const { redisData } = require('./backend');

const app = express();
const port = 3200;
app.use(express.static(path.join(__dirname)));
// Serve urlChecker.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'urlChecker.html'));
});

app.get('/url-data', (req, res) => {
  res.json(redisData);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
