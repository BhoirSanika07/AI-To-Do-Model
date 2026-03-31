const Task = require('../models/Task');
const Notification = require('../models/Notification');

const checkDueTasks = async () => {
  try {
    const now = new Date();
    const in30min = new Date(now.getTime() + 30 * 60 * 1000);
    const overdue = new Date(now.getTime() - 1 * 60 * 1000);

    // Due soon tasks (within 30 min)
    const dueSoonTasks = await Task.find({
      status: { $in: ['pending', 'in-progress'] },
      dueDate: { $gte: now, $lte: in30min },
      notified: false
    }).populate('user', 'name email');

    for (const task of dueSoonTasks) {
      await Notification.create({
        user: task.user._id,
        task: task._id,
        type: 'due_soon',
        title: '⏰ Task Due Soon',
        message: `"${task.title}" is due in 30 minutes!`
      });
      task.notified = true;
      task.notifiedAt = now;
      await task.save();
    }

    // Overdue tasks
    const overdueTasks = await Task.find({
      status: { $in: ['pending', 'in-progress'] },
      dueDate: { $lt: now },
      notified: true
    }).populate('user', 'name');

    for (const task of overdueTasks) {
      const alreadyNotified = await Notification.findOne({
        task: task._id,
        type: 'overdue',
        createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) }
      });
      if (!alreadyNotified) {
        await Notification.create({
          user: task.user._id,
          task: task._id,
          type: 'overdue',
          title: '🚨 Task Overdue',
          message: `"${task.title}" is overdue! Please complete it ASAP.`
        });
      }
    }
  } catch (err) {
    console.error('Notification cron error:', err);
  }
};

module.exports = { checkDueTasks };
