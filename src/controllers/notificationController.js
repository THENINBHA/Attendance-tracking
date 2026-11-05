const Notification = require('../models/Notification');
const { ApiError, wrap } = require('../utils/errors');
const v = require('../utils/validate');
exports.list = wrap(async (req, res) => {
  const [data, unread] = await Promise.all([
    Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);
  res.json({ success: true, unread, data });
});
exports.markRead = wrap(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: v.id(req.params.id, 'id'), userId: req.user._id }, { read: true }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found');
  res.json({ success: true, data: n });
});
exports.readAll = wrap(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});