const mongoose = require('mongoose');

// A generic, reusable approval record. Today only LEAVE requests create one
// of these, but the shape (requestType + requestId) means a future request
// type (e.g. expense claims, WFH requests) can reuse this exact model and
// the same approval service/UI instead of building a brand new workflow.
const approvalSchema = new mongoose.Schema(
  {
    requestType: { type: String, enum: ['LEAVE'], required: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'requestType' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    // Null approver means "no specific manager — any HR_ADMIN/SUPER_ADMIN
    // may act on this", per the Module 8 fallback rule.
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comment: { type: String, default: '' },
    actionDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Approval', approvalSchema);
