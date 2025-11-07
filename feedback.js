const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all feedback
router.get('/', async (req, res) => {
  try {
    // Try different possible table names
    const [feedback] = await db.query(
      'SELECT * FROM complaintssuggestions ORDER BY ComplaintID DESC'
    );

    res.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Get feedback error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get feedback', 
      error: error.message 
    });
  }
});

// Submit feedback
router.post('/submit', async (req, res) => {
  try {
    const { userId, message } = req.body;

    console.log('📝 Feedback submission:', { userId, message });

    // Insert with exact columns from database: UserID (optional) and Description
    const [result] = await db.query(
      'INSERT INTO complaintssuggestions (UserID, Description) VALUES (?, ?)',
      [userId || null, message]
    );

    console.log('✅ Feedback saved successfully:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: result.insertId
    });
  } catch (error) {
    console.error('❌ Feedback submission error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit feedback', 
      error: error.message 
    });
  }
});

module.exports = router;
