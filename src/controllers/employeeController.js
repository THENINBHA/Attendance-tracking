const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');

async function checkManager(mid) {
  if (!mid) return null;
  v.id(mid, 'managerId');
  const m = await User.findOne({ _id: mid, role: 'manager', isActive: true });
  if (!m) throw new ApiError(400, 'managerId must be an active manager');
  return m._id;
}
const ROLES = ['employee', 'manager'];

exports.list = wrap(async (_req, res) => res.json({ success: true, data: await User.find().sort({ employeeId: 1 }).populate('managerId', 'name employeeId') }));
exports.team = wrap(async (req, res) => res.json({ success: true, data: await User.find({ managerId: req.user._id, isActive: true }).sort({ name: 1 }) }));

exports.create = wrap(async (req, res) => {
  const b = req.body;
  if (!ROLES.includes(b.role)) throw new ApiError(400, 'role must be employee or manager (admins are created via the init-admin script)');
  const u = await User.create({
    name: v.str(b.name, 'Name', { max: 100 }), email: v.email(b.email), employeeId: v.str(b.employeeId, 'Employee ID', { max: 30 }),
    role: b.role, department: typeof b.department === 'string' ? b.department.trim().slice(0, 100) : '',
    managerId: await checkManager(b.managerId), passwordHash: await bcrypt.hash(v.password(b.password), 10),
  });
  res.status(201).json({ success: true, data: u });
});

exports.update = wrap(async (req, res) => {
  const u = await User.findById(v.id(req.params.id, 'id'));
  if (!u) throw new ApiError(404, 'Employee not found');
  const b = req.body;
  if (u.role === 'admin' && (b.role || b.isActive === false)) throw new ApiError(400, 'Admin accounts cannot be changed here');
  if (b.name !== undefined) u.name = v.str(b.name, 'Name', { max: 100 });
  if (b.email !== undefined) u.email = v.email(b.email);
  if (b.department !== undefined) u.department = String(b.department).trim().slice(0, 100);
  if (b.role !== undefined) { if (!ROLES.includes(b.role)) throw new ApiError(400, 'Invalid role'); u.role = b.role; }
  if (b.managerId !== undefined) { const m = await checkManager(b.managerId || null); if (m && String(m) === String(u._id)) throw new ApiError(400, 'Cannot manage self'); u.managerId = m; }
  if (b.isActive !== undefined) u.isActive = b.isActive === true;
  if (b.password) u.passwordHash = await bcrypt.hash(v.password(b.password), 10);
  await u.save();
  res.json({ success: true, data: u });
});

exports.deactivate = wrap(async (req, res) => {
  const u = await User.findById(v.id(req.params.id, 'id'));
  if (!u) throw new ApiError(404, 'Employee not found');
  if (u.role === 'admin') throw new ApiError(400, 'Admin accounts cannot be deactivated here');
  u.isActive = false; await u.save();
  res.json({ success: true, data: u });
});
