const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
const HOME = { employee: '/pages/employee-dashboard.html', manager: '/pages/manager-dashboard.html', admin: '/pages/admin-dashboard.html' };
const DUMMY = bcrypt.hashSync('timing-equalizer', 10);

exports.login = wrap(async (req, res) => {
  const email = v.email(req.body.email); // rejects objects like {"$gt":""} (NoSQL injection)
  const pw = v.str(req.body.password, 'Password', { max: 200 });
  const u = await User.findOne({ email });
  const ok = await bcrypt.compare(pw, u ? u.passwordHash : DUMMY);
  if (!u || !ok) throw new ApiError(401, 'Invalid email or password');
  if (!u.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');
  await new Promise((r, j) => req.session.regenerate((e) => (e ? j(e) : r())));
  req.session.userId = String(u._id);
  res.json({ success: true, user: u, redirect: HOME[u.role] });
});
exports.logout = (req, res) => req.session.destroy(() => { res.clearCookie('sid'); res.json({ success: true }); });
exports.me = (req, res) => res.json({ success: true, user: req.user, redirect: HOME[req.user.role] });

exports.changePassword = wrap(async (req, res) => {
  const cur = v.str(req.body.currentPassword, 'Current password', { max: 200 });
  const next = v.password(req.body.newPassword);
  if (!(await bcrypt.compare(cur, req.user.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  if (cur === next) throw new ApiError(400, 'New password must be different from the current one');
  req.user.passwordHash = await bcrypt.hash(next, 10);
  await req.user.save();
  res.json({ success: true });
});

exports.HOME = HOME;
