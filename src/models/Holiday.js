const mongoose = require('mongoose');
module.exports = mongoose.model('Holiday', new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
}));
