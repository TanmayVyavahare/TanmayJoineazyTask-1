const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    oneDriveLink: { type: String, required: true, trim: true },
    targetType: { type: String, enum: ['all', 'specific'], default: 'all' },
    targetGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Assignment', assignmentSchema);

