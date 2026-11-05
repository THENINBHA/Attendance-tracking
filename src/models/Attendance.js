const mongoose = require('mongoose');
const s = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD in configured timezone
  clockIn: { type: Date, default: null },
  clockOut: { type: Date, default: null },
  workingMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ['Present', 'Late', 'Absent'], required: true },
}, { timestamps: true });
s.index({ employeeId: 1, date: 1 }, { unique: true }); // one record per employee per day
s.index({ date: 1, status: 1 });
module.exports = mongoose.model('Attendance', s);
