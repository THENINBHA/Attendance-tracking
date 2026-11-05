const LeaveRequest = require('../models/LeaveRequest');
const LeavePolicy = require('../models/LeavePolicy');
const User = require('../models/User');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
const { nowParts } = require('../utils/dates');
const svc = require('../services/leaveService');
const { notify } = require('../services/notificationService');

exports.balances = wrap(async (req, res) => {
  const year = Number(req.query.year) || Number(nowParts().date.slice(0, 4));
  res.json({ success: true, year, data: await svc.getBalances(req.user, year) });
});

// Shared by submit and the live preview (SCRUM-4 / SCRUM-6)
async function check(user, body) {
  const leaveType = v.str(body.leaveType, 'Leave type', { max: 50 });
  const startDate = v.date(body.startDate, 'Start date');
  const endDate = v.date(body.endDate, 'End date');
  if (endDate < startDate) throw new ApiError(400, 'End date cannot be before start date');
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) throw new ApiError(400, 'A request cannot span two calendar years; submit separate requests');
  if (startDate < nowParts().date) throw new ApiError(400, 'Start date cannot be in the past');
  const policy = await LeavePolicy.findOne({ leaveType, active: true, applicableRoles: user.role });
  if (!policy) throw new ApiError(400, 'Unknown or unavailable leave type');
  const workingDays = await svc.countWorkingDays(startDate, endDate);
  if (workingDays < 1) throw new ApiError(400, 'The selected range contains no working days (weekends/holidays only)');
  if (await svc.hasOverlap(user._id, startDate, endDate)) throw new ApiError(409, 'You already have a pending or approved leave overlapping these dates');
  const bal = (await svc.getBalances(user, Number(startDate.slice(0, 4)))).find((b) => b.leaveType === leaveType);
  if (!bal || bal.available < workingDays) throw new ApiError(400, `Insufficient ${leaveType} balance: ${bal ? bal.available : 0} available, ${workingDays} requested`);
  return { leaveType, startDate, endDate, workingDays, bal };
}

exports.apply = wrap(async (req, res) => {
  const reason = v.str(req.body.reason, 'Reason', { min: 3, max: 500 });
  const c = await check(req.user, req.body);
  const doc = await LeaveRequest.create({ employeeId: req.user._id, leaveType: c.leaveType, startDate: c.startDate, endDate: c.endDate, workingDays: c.workingDays, reason });
  await notify(req.user.managerId, 'leave_submitted', `${req.user.name} applied for ${c.workingDays} day(s) of ${c.leaveType} (${c.startDate} to ${c.endDate})`, '/pages/leave-approvals.html');
  res.status(201).json({ success: true, data: doc });
});

exports.preview = wrap(async (req, res) => {
  try {
    const c = await check(req.user, req.query);
    res.json({ success: true, ok: true, workingDays: c.workingDays, available: c.bal.available, remainingAfter: c.bal.available - c.workingDays });
  } catch (e) {
    if (e instanceof ApiError) return res.json({ success: true, ok: false, message: e.message });
    throw e;
  }
});

exports.mine = wrap(async (req, res) => res.json({ success: true, data: await LeaveRequest.find({ employeeId: req.user._id }).sort({ createdAt: -1 }).populate('reviewedBy', 'name') }));

exports.cancel = wrap(async (req, res) => {
  const r = await LeaveRequest.findOneAndUpdate(
    { _id: v.id(req.params.id, 'id'), employeeId: req.user._id, status: { $in: ['Pending', 'Approved'] }, startDate: { $gte: nowParts().date } },
    { status: 'Cancelled' }, { new: true });
  if (!r) throw new ApiError(400, 'Request not found, not yours, or can no longer be cancelled');
  await notify(req.user.managerId, 'leave_cancelled', `${req.user.name} cancelled ${r.leaveType} (${r.startDate} to ${r.endDate})`, '/pages/team-attendance.html');
  res.json({ success: true, data: r });
});

async function teamIds(manager) { return (await User.find({ managerId: manager._id }).select('_id')).map((u) => u._id); }

exports.pending = wrap(async (req, res) => res.json({ success: true, data: await LeaveRequest.find({ status: 'Pending', employeeId: { $in: await teamIds(req.user) } }).sort({ startDate: 1 }).populate('employeeId', 'name employeeId department') }));

exports.review = wrap(async (req, res) => {
  const action = req.body.action;
  if (!['approve', 'reject'].includes(action)) throw new ApiError(400, "action must be 'approve' or 'reject'");
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';
  const rejectionReason = action === 'reject' ? v.str(req.body.rejectionReason, 'Rejection reason', { min: 3, max: 500 }) : '';
  const reqDoc = await LeaveRequest.findById(v.id(req.params.id, 'id'));
  if (!reqDoc) throw new ApiError(404, 'Leave request not found');
  const emp = await User.findById(reqDoc.employeeId);
  if (!emp || String(emp.managerId) !== String(req.user._id)) throw new ApiError(403, 'This request is not from your team');
  if (reqDoc.status !== 'Pending') throw new ApiError(409, `Request already ${reqDoc.status.toLowerCase()}`);
  if (action === 'approve') {
    const b = (await svc.getBalances(emp, Number(reqDoc.startDate.slice(0, 4)))).find((x) => x.leaveType === reqDoc.leaveType);
    if (!b || b.allocated - b.used - (b.pending - reqDoc.workingDays) < reqDoc.workingDays) throw new ApiError(400, 'Employee no longer has sufficient balance for this leave type');
  }
  const updated = await LeaveRequest.findOneAndUpdate({ _id: reqDoc._id, status: 'Pending' },
    { status: action === 'approve' ? 'Approved' : 'Rejected', reviewedBy: req.user._id, reviewedAt: new Date(), reviewComment: comment, rejectionReason }, { new: true });
  if (!updated) throw new ApiError(409, 'Request was already processed');
  const what = `${updated.leaveType} (${updated.startDate} to ${updated.endDate})`;
  await notify(emp._id, action === 'approve' ? 'leave_approved' : 'leave_rejected',
    action === 'approve' ? `Your ${what} was approved by ${req.user.name}` : `Your ${what} was rejected by ${req.user.name}: ${rejectionReason}`, '/pages/leave-history.html');
  res.json({ success: true, data: updated });
});