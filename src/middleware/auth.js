const User = require('../models/User');
const { ApiError, wrap } = require('../utils/errors');
const requireAuth = wrap(async (req, _res, next) => {
  if (!req.session || !req.session.userId) throw new ApiError(401, 'Authentication required');
  const u = await User.findById(req.session.userId);
  if (!u || !u.isActive) { req.session.destroy(() => {}); throw new ApiError(401, 'Account unavailable'); }
  req.user = u; next();
});
const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, 'You do not have permission to do this'));
module.exports = { requireAuth, requireRole };
