const express = require('express');
const Group = require('../models/Group');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin-summary', auth, requireRole('admin'), async (_req, res) => {
  const [groupCount, assignmentCount, submissionCount, groups, assignments, submissions] = await Promise.all([
    Group.countDocuments(),
    Assignment.countDocuments(),
    Submission.countDocuments(),
    Group.find().select('_id name members'),
    Assignment.find().select('_id title targetType targetGroups'),
    Submission.find().select('assignment group'),
  ]);

  const expectedByAssignment = assignments.map((a) => {
    const expectedGroups =
      a.targetType === 'all'
        ? groups.length
        : groups.filter((g) => a.targetGroups.some((tg) => String(tg) === String(g._id))).length;
    const done = submissions.filter((s) => String(s.assignment) === String(a._id)).length;
    return {
      assignmentId: a._id,
      title: a.title,
      expectedGroups,
      confirmedGroups: done,
      completionRate: expectedGroups ? Math.round((done / expectedGroups) * 100) : 0,
    };
  });

  const overallExpected = expectedByAssignment.reduce((acc, x) => acc + x.expectedGroups, 0);
  const overallDone = expectedByAssignment.reduce((acc, x) => acc + x.confirmedGroups, 0);

  res.json({
    counts: {
      groups: groupCount,
      assignments: assignmentCount,
      confirmations: submissionCount,
      overallCompletionRate: overallExpected ? Math.round((overallDone / overallExpected) * 100) : 0,
    },
    assignmentPerformance: expectedByAssignment,
  });
});

module.exports = router;

