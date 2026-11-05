const LeavePolicy = require('../models/LeavePolicy');
const Holiday = require('../models/Holiday');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
const ROLES = ['employee', 'manager'];
function body(b) {
  const days = Number(b.annualAllocation);
  if (!Number.isFinite(days) || days < 0 || days > 365) throw new ApiError(400, 'annualAllocation must be 0-365');
  const roles = Array.isArray(b.applicableRoles) && b.applicableRoles.length ? b.applicableRoles : ROLES;
  if (!roles.every((r) => ROLES.includes(r))) throw new ApiError(400, 'Invalid applicableRoles');
  return { leaveType: v.str(b.leaveType, 'Leave type', { max: 50 }), annualAllocation: days, applicableRoles: roles, active: b.active !== false,
    carryForward: { enabled: !!(b.carryForward && b.carryForward.enabled), maxDays: Number(b.carryForward && b.carryForward.maxDays) || 0 } };
}
exports.list = wrap(async (_q, res) => res.json({ success: true, data: await LeavePolicy.find().sort({ leaveType: 1 }) }));
exports.create = wrap(async (req, res) => res.status(201).json({ success: true, data: await LeavePolicy.create(body(req.body)) }));
exports.update = wrap(async (req, res) => {
  const p = await LeavePolicy.findByIdAndUpdate(v.id(req.params.id, 'id'), body(req.body), { new: true, runValidators: true });
  if (!p) throw new ApiError(404, 'Policy not found');
  res.json({ success: true, data: p });
});
exports.holidays = wrap(async (_q, res) => res.json({ success: true, data: await Holiday.find().sort({ date: 1 }) }));
exports.addHoliday = wrap(async (req, res) => res.status(201).json({ success: true, data: await Holiday.create({ date: v.date(req.body.date, 'Date'), name: v.str(req.body.name, 'Name', { max: 100 }), description: String(req.body.description || '').slice(0, 300) }) }));
exports.delHoliday = wrap(async (req, res) => { await Holiday.findByIdAndDelete(v.id(req.params.id, 'id')); res.json({ success: true }); });
