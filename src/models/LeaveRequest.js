const mongoose = require('mongoose');
const s = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  workingDays: { type: Number, required: true, min: 0.5 },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], default: 'Pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewComment: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});
s.index({ employeeId: 1, status: 1, startDate: 1 });
s.index({ status: 1, startDate: 1, endDate: 1 });
module.exports = mongoose.model('LeaveRequest', s);
