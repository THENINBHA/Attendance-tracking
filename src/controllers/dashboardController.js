const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { wrap } = require('../utils/errors');
const { nowParts } = require('../utils/dates');
const svc = require('../services/leaveService');

exports.get = wrap(async (req, res) => {
  const { date } = nowParts(); const u = req.user; const out = { role: u.role, today: date };
  if (u.role === 'admin') {
    const [total, active, pending, att] = await Promise.all([User.countDocuments(), User.countDocuments({ isActive: true }), LeaveRequest.countDocuments({ status: 'Pending' }), Attendance.aggregate([{ $match: { date } }, { $group: { _id: '$status', n: { $sum: 1 } } }])]);
    out.stats = { totalUsers: total, activeUsers: active, pendingLeaves: pending, presentToday: (att.find((a) => a._id === 'Present') || {}).n || 0, lateToday: (att.find((a) => a._id === 'Late') || {}).n || 0, absentToday: (att.find((a) => a._id === 'Absent') || {}).n || 0 };
  } else {
    out.balances = await svc.getBalances(u, Number(date.slice(0, 4)));
    out.attendanceToday = await Attendance.findOne({ employeeId: u._id, date });
    out.pendingRequests = await LeaveRequest.countDocuments({ employeeId: u._id, status: 'Pending' });
    if (u.role === 'manager') {
      const team = await User.find({ managerId: u._id, isActive: true }).select('_id');
      const ids = team.map((t) => t._id);
      const att = await Attendance.aggregate([{ $match: { date, employeeId: { $in: ids } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
      const onLeave = await svc.approvedLeaveOn(date, ids);
      out.team = { size: ids.length, pendingApprovals: await LeaveRequest.countDocuments({ status: 'Pending', employeeId: { $in: ids } }), present: (att.find((a) => a._id === 'Present') || {}).n || 0, late: (att.find((a) => a._id === 'Late') || {}).n || 0, absent: (att.find((a) => a._id === 'Absent') || {}).n || 0, onLeave: onLeave.length };
    }
  }
  res.json({ success: true, data: out });
});
