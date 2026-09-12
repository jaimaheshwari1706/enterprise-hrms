const mongoose = require('mongoose');

// Atomic sequence generator (e.g. employee ids EMP0001, EMP0002, ...).
// `findOneAndUpdate` with `$inc` is a single atomic operation on the server,
// so two concurrent creates can never receive the same number — unlike the
// old countDocuments()+1 approach.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "employeeId"
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Counter', counterSchema);
