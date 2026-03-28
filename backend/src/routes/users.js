const express = require('express');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/students', auth, async (_req, res) => {
  const students = await User.find({ role: 'student' }).select('_id name email studentId').sort({ createdAt: -1 });
  res.json(students);
});

router.get('/admins-only-students', auth, requireRole('admin'), async (_req, res) => {
  const students = await User.find({ role: 'student' }).select('_id name email studentId').sort({ name: 1 });
  res.json(students);
});

module.exports = router;

