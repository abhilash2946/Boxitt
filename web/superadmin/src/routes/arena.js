const express = require('express');
const router = express.Router();
const Arena = require('../models/Arena');


// GET /api/arenas
router.get('/', async (req, res) => {
  try {
    const arenas = await Arena.find();
    res.json(arenas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/arenas/:id
router.get('/:id', async (req, res) => {
  try {
    const arena = await Arena.findById(req.params.id);
    if (!arena) return res.status(404).json({ error: 'Arena not found' });
    res.json(arena);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/arena
router.post('/admin/arena', async (req, res) => {
  try {
    const arena = new Arena(req.body);
    await arena.save();
    res.status(201).json(arena);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/arena/:id
router.put('/admin/arena/:id', async (req, res) => {
  try {
    const arena = await Arena.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!arena) return res.status(404).json({ error: 'Arena not found' });
    res.json(arena);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
