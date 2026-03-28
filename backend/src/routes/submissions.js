const express = require('express');
const Submission = require('../models/Submission');
const Group = require('../models/Group');
const Assignment = require('../models/Assignment');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/confirm/:assignmentId', auth, requireRole('student'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const group = await Group.findOne({ members: req.user._id });
    if (!group) return res.status(400).json({ message: 'Join or create a group first' });

    const allowed =
      assignment.targetType === 'all' ||
      assignment.targetGroups.some((gid) => String(gid) === String(group._id));
    if (!allowed) return res.status(403).json({ message: 'Assignment not assigned to your group' });

    const submission = await Submission.findOneAndUpdate(
      { assignment: assignment._id, group: group._id },
      { confirmedBy: req.user._id, confirmedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
      .populate('assignment', 'title dueDate')
      .populate('group', 'name')
      .populate('confirmedBy', 'name email');

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my-group', auth, requireRole('student'), async (req, res) => {
  const group = await Group.findOne({ members: req.user._id });
  if (!group) return res.json([]);

  const submissions = await Submission.find({ group: group._id })
    .populate('assignment', 'title dueDate')
    .populate('confirmedBy', 'name email')
    .sort({ confirmedAt: -1 });
  res.json(submissions);
});

router.get('/admin-overview', auth, requireRole('admin'), async (_req, res) => {
  const submissions = await Submission.find()
    .populate('assignment', 'title')
    .populate('group', 'name members')
    .populate('confirmedBy', 'name email')
    .sort({ confirmedAt: -1 });
  res.json(submissions);
});

module.exports = router;

