const Attendance = require('../models/Attendance');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
const { nowParts, eachDay, isWeekend } = require('../utils/dates');
const Holiday = require('../models/Holiday');
const svc = require('../services/attendanceService');

exports.clockIn = wrap(async (req, res) => res.status(201).json({ success: true, data: await svc.clockIn(req.user) }));
exports.clockOut = wrap(async (req, res) => res.json({ success: true, data: await svc.clockOut(req.user) }));
exports.today = wrap(async (req, res) => res.json({ success: true, data: await Attendance.findOne({ employeeId: req.user._id, date: nowParts().date }) }));
exports.mine = wrap(async (req, res) => {
  const q = { employeeId: req.user._id };
  if (req.query.from || req.query.to) q.date = { ...(req.query.from && { $gte: v.date(req.query.from, 'from') }), ...(req.query.to && { $lte: v.date(req.query.to, 'to') }) };
  res.json({ success: true, data: await Attendance.find(q).sort({ date: -1 }).limit(366) });
});
exports.markAbsent = wrap(async (req, res) => {
  const date = req.body.date ? v.date(req.body.date, 'date') : nowParts().date;
  res.json({ success: true, date, ...(await svc.markAbsent(date)) });
});

// Manager (own team only) / admin (everyone). Adds derived "On Leave" rows.
exports.team = wrap(async (req, res) => {
  const today = nowParts().date;
  const to = req.query.to ? v.date(req.query.to, 'to') : today;
  const from = req.query.from ? v.date(req.query.from, 'from') : to;
  if (from > to) throw new ApiError(400, 'from must not be after to');
  const days = [...eachDay(from, to)];
  if (days.length > 62) throw new ApiError(400, 'Date range is limited to 62 days');
  const status = req.query.status;
  if (status && !['Present', 'Absent', 'Late', 'On Leave'].includes(status)) throw new ApiError(400, 'Invalid status filter');
  const base = req.user.role === 'admin' ? { role: { $ne: 'admin' } } : { managerId: req.user._id };
  const members = await User.find({ ...base, isActive: true }).select('name employeeId').lean();
  const ids = members.map((m) => m._id);
  if (req.query.employeeId && !ids.some((i) => String(i) === req.query.employeeId)) throw new ApiError(403, 'Employee is not in your team');
  const [recs, leaves, hols] = await Promise.all([
    Attendance.find({ employeeId: { $in: ids }, date: { $gte: from, $lte: to } }).lean(),
    LeaveRequest.find({ employeeId: { $in: ids }, status: 'Approved', startDate: { $lte: to }, endDate: { $gte: from } }).lean(),
    Holiday.find({ date: { $gte: from, $lte: to } }).lean(),
  ]);
  const hset = new Set(hols.map((h) => h.date));
  const rows = [];
  for (const m of members) {
    if (req.query.employeeId && String(m._id) !== req.query.employeeId) continue;
    for (const d of days) {
      const r = recs.find((x) => String(x.employeeId) === String(m._id) && x.date === d);
      const onLeave = leaves.some((l) => String(l.employeeId) === String(m._id) && l.startDate <= d && l.endDate >= d);
      let st = null;
      if (r) st = r.status; else if (onLeave && !isWeekend(d) && !hset.has(d)) st = 'On Leave';
      if (!st) continue;
      rows.push({ name: m.name, employeeId: m.employeeId, date: d, clockIn: r && r.clockIn, clockOut: r && r.clockOut, workingMinutes: r ? r.workingMinutes : 0, status: st });
    }
  }
  const out = rows.filter((r) => !status || r.status === status).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  res.json({ success: true, data: out });
});
