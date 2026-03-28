const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    confirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

submissionSchema.index({ assignment: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);

