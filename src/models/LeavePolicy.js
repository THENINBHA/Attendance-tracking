const mongoose = require('mongoose');
module.exports = mongoose.model('LeavePolicy', new mongoose.Schema({
  leaveType: { type: String, required: true, unique: true, trim: true },
  annualAllocation: { type: Number, required: true, min: 0 },
  applicableRoles: { type: [String], default: ['employee', 'manager'] },
  carryForward: { enabled: { type: Boolean, default: false }, maxDays: { type: Number, default: 0 } },
  active: { type: Boolean, default: true },
}));
