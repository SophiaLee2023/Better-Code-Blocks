const express = require('express');
const app = express();

function handler(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send(`bad id: ${req.params.id}`);
  res.json({ id, ok: true });
}

app.get('/items/:id', handler);
app.listen(3000, () => console.log('listening'));
