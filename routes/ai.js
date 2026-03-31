const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Task = require('../models/Task');

// AI: Parse natural language task input
router.post('/parse-task', protect, async (req, res) => {
  try {
    const { input } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Parse this task request and return ONLY a JSON object (no markdown, no explanation):
"${input}"

Return this exact JSON structure:
{
  "title": "task title",
  "description": "brief description or empty string",
  "priority": "low|medium|high|urgent",
  "category": "work|personal|health|finance|learning|other",
  "dueDate": "YYYY-MM-DD or null",
  "dueTime": "HH:MM or null",
  "tags": ["tag1", "tag2"],
  "subtasks": ["subtask1", "subtask2"]
}

Today's date: ${new Date().toISOString().split('T')[0]}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    res.json({ parsed });
  } catch (err) {
    res.status(500).json({ message: 'AI parsing failed', error: err.message });
  }
});

// AI: Get productivity suggestions
router.post('/suggestions', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.user._id,
      status: { $in: ['pending', 'in-progress'] }
    }).limit(20).sort('-createdAt');

    const taskSummary = tasks.map(t => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      category: t.category,
      status: t.status
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Analyze these pending tasks for user ${req.user.name} and provide actionable productivity advice. Return ONLY JSON (no markdown):

Tasks: ${JSON.stringify(taskSummary)}
Today: ${new Date().toISOString()}

Return:
{
  "insights": ["insight1", "insight2", "insight3"],
  "topPriority": "what to focus on first",
  "warning": "any overdue or urgent item to flag",
  "suggestion": "one specific productivity tip"
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const suggestions = JSON.parse(text);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ message: 'Could not generate suggestions' });
  }
});

// AI: Smart chat assistant
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    const tasks = await Task.find({ user: req.user._id }).limit(30).sort('-updatedAt');
    const taskContext = tasks.map(t => `[${t.status}] ${t.title} (${t.priority} priority, due: ${t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'no date'})`).join('\n');

    const messages = [
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: `You are TaskFlow AI, a friendly and smart productivity assistant for ${req.user.name}. 
Help them manage tasks, plan their day, and stay productive. Be concise and actionable.
Current tasks:\n${taskContext}\nToday: ${new Date().toISOString()}`,
        messages
      })
    });

    const data = await response.json();
    res.json({ reply: data.content[0].text, role: 'assistant' });
  } catch (err) {
    res.status(500).json({ message: 'AI chat failed' });
  }
});

module.exports = router;
