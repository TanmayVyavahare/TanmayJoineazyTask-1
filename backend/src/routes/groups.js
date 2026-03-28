const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, requireRole('student'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const existing = await Group.findOne({ members: req.user._id });
    if (existing) return res.status(409).json({ message: 'You are already in a group' });

    const group = await Group.create({
      name,
      createdBy: req.user._id,
      members: [req.user._id],
    });

    const populated = await Group.findById(group._id).populate('members', 'name email studentId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my', auth, requireRole('student'), async (req, res) => {
  const group = await Group.findOne({ members: req.user._id }).populate('members', 'name email studentId');
  res.json(group);
});

router.post('/:groupId/members', auth, requireRole('student'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email, studentId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.some((m) => String(m) === String(req.user._id))) {
      return res.status(403).json({ message: 'You are not in this group' });
    }

    const query = email ? { email: email.toLowerCase(), role: 'student' } : { studentId, role: 'student' };
    if (!email && !studentId) return res.status(400).json({ message: 'Provide email or studentId' });

    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'Student not found' });

    const otherGroup = await Group.findOne({ members: user._id });
    if (otherGroup && String(otherGroup._id) !== String(group._id)) {
      return res.status(409).json({ message: 'Student is already in another group' });
    }

    if (!group.members.some((m) => String(m) === String(user._id))) {
      group.members.push(user._id);
      await group.save();
    }

    const populated = await Group.findById(group._id).populate('members', 'name email studentId');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', auth, requireRole('admin'), async (_req, res) => {
  const groups = await Group.find()
    .populate('createdBy', 'name email')
    .populate('members', 'name email studentId')
    .sort({ createdAt: -1 });
  res.json(groups);
});

module.exports = router;

