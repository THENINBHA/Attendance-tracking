const mongoose = require('mongoose');
const s = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  role: { type: String, enum: ['employee', 'manager', 'admin'], required: true, index: true },
  department: { type: String, trim: true, default: '' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
s.set('toJSON', { transform: (_d, r) => { delete r.passwordHash; delete r.__v; return r; } });
module.exports = mongoose.model('User', s);
