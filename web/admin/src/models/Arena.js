const mongoose = require('mongoose');

const ArenaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }],
  description: { type: String },
  price: { type: Number, required: true },
  rating: { type: Number, default: 0 },
  timings: { type: String },
  location: { type: String },
  advanceBooking: {
    required: { type: Boolean, default: false },
    amount: { type: Number, default: 0 }
  },
  contact: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Arena', ArenaSchema);
