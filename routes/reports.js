const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// Daily report
router.get('/daily', protect, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const [completed, created, overdue, inProgress] = await Promise.all([
      Task.find({ user: req.user._id, completedAt: { $gte: start, $lte: end } }),
      Task.find({ user: req.user._id, createdAt: { $gte: start, $lte: end } }),
      Task.find({ user: req.user._id, status: { $in: ['pending', 'in-progress'] }, dueDate: { $lt: start } }),
      Task.find({ user: req.user._id, status: 'in-progress' })
    ]);

    res.json({
      date: start.toISOString().split('T')[0],
      completed: completed.length,
      created: created.length,
      overdue: overdue.length,
      inProgress: inProgress.length,
      completedTasks: completed,
      createdTasks: created,
      overdueTasks: overdue
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Weekly report
router.get('/weekly', protect, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const tasks = await Task.find({
      user: req.user._id,
      createdAt: { $gte: weekStart }
    });

    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayCompleted = tasks.filter(t =>
        t.completedAt >= dayStart && t.completedAt <= dayEnd
      ).length;
      const dayCreated = tasks.filter(t =>
        t.createdAt >= dayStart && t.createdAt <= dayEnd
      ).length;

      dailyData.push({
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dayStart.toISOString().split('T')[0],
        completed: dayCompleted,
        created: dayCreated
      });
    }

    const categoryBreakdown = {};
    tasks.forEach(t => {
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + 1;
    });

    const priorityBreakdown = {};
    tasks.forEach(t => {
      priorityBreakdown[t.priority] = (priorityBreakdown[t.priority] || 0) + 1;
    });

    res.json({
      weekStart: weekStart.toISOString().split('T')[0],
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      dailyData,
      categoryBreakdown,
      priorityBreakdown
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
