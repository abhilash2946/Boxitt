const express = require('express');
const mongoose = require('mongoose');
const arenaRoutes = require('./routes/arena');
const app = express();

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/boxit', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use('/api/arenas', arenaRoutes);
app.use('/api/admin', arenaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
