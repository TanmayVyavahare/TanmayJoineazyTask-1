const express = require('express');
const Assignment = require('../models/Assignment');
const Group = require('../models/Group');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { title, description, dueDate, oneDriveLink, targetType, targetGroups } = req.body;
    if (!title || !description || !dueDate || !oneDriveLink) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const assignment = await Assignment.create({
      title,
      description,
      dueDate,
      oneDriveLink,
      targetType: targetType === 'specific' ? 'specific' : 'all',
      targetGroups: targetType === 'specific' ? (targetGroups || []) : [],
      createdBy: req.user._id,
    });

    const populated = await Assignment.findById(assignment._id)
      .populate('targetGroups', 'name')
      .populate('createdBy', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, oneDriveLink, targetType, targetGroups } = req.body;
    const updated = await Assignment.findByIdAndUpdate(
      id,
      {
        title,
        description,
        dueDate,
        oneDriveLink,
        targetType: targetType === 'specific' ? 'specific' : 'all',
        targetGroups: targetType === 'specific' ? (targetGroups || []) : [],
      },
      { new: true, runValidators: true },
    )
      .populate('targetGroups', 'name')
      .populate('createdBy', 'name email');

    if (!updated) return res.status(404).json({ message: 'Assignment not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const all = await Assignment.find().populate('targetGroups', 'name').sort({ createdAt: -1 });
      return res.json(all);
    }

    const myGroup = await Group.findOne({ members: req.user._id });
    const groupId = myGroup?._id;

    const assignments = await Assignment.find({
      $or: [{ targetType: 'all' }, { targetType: 'specific', targetGroups: groupId }],
    })
      .populate('targetGroups', 'name')
      .sort({ createdAt: -1 });

    return res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

