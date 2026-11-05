module.exports = {
  notFound: (_req, res) => res.status(404).json({ success: false, message: 'Not found' }),
  handler: (err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON' });
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate value: ' + Object.keys(err.keyPattern || {}).join(', ') });
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ success: false, message: err.message });
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ success: false, message: status === 500 ? 'Internal server error' : err.message, details: err.details });
  },
};
