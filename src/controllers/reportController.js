const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
const { nowParts } = require('../utils/dates');
const range = (q) => { const to = q.to ? v.date(q.to, 'to') : nowParts().date; const from = q.from ? v.date(q.from, 'from') : to.slice(0, 8) + '01'; if (from > to) throw new ApiError(400, 'from must not be after to'); return { from, to }; };
const csv = (rows) => { if (!rows.length) return ''; const k = Object.keys(rows[0]); const e = (x) => { let s = String(x ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; return [k.join(','), ...rows.map((r) => k.map((c) => e(r[c])).join(','))].join('\n'); };
const send = (req, res, rows, name) => req.query.format === 'csv'
  ? res.type('text/csv').attachment(`${name}.csv`).send(csv(rows)) : res.json({ success: true, data: rows });

exports.attendance = wrap(async (req, res) => {
  const { from, to } = range(req.query);
  const agg = await Attendance.aggregate([{ $match: { date: { $gte: from, $lte: to } } },
    { $group: { _id: '$employeeId', present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } }, minutes: { $sum: '$workingMinutes' } } }]);
  const users = await User.find({ role: { $ne: 'admin' } }).sort({ employeeId: 1 }).lean();
  send(req, res, users.map((u) => { const a = agg.find((x) => String(x._id) === String(u._id)) || {}; return { employeeId: u.employeeId, name: u.name, department: u.department, present: a.present || 0, late: a.late || 0, absent: a.absent || 0, totalHours: +((a.minutes || 0) / 60).toFixed(2) }; }), `attendance_${from}_${to}`);
});

exports.leave = wrap(async (req, res) => {
  const { from, to } = range(req.query);
  const rows = await LeaveRequest.find({ startDate: { $lte: to }, endDate: { $gte: from } }).sort({ startDate: 1 }).populate('employeeId', 'name employeeId').populate('reviewedBy', 'name').lean();
  send(req, res, rows.map((r) => ({ employeeId: r.employeeId && r.employeeId.employeeId, name: r.employeeId && r.employeeId.name, leaveType: r.leaveType, startDate: r.startDate, endDate: r.endDate, workingDays: r.workingDays, status: r.status, reviewedBy: r.reviewedBy && r.reviewedBy.name, rejectionReason: r.rejectionReason })), `leave_${from}_${to}`);
});
