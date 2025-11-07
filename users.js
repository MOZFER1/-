const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [users] = await db.query(
      'SELECT UserID as id, Username, Email FROM registereduser WHERE UserID = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user', 
      error: error.message 
    });
  }
});

// Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;

    console.log('📝 Updating user profile:', { id, username, email });

    await db.query(
      'UPDATE registereduser SET Username = ?, Email = ? WHERE UserID = ?',
      [username, email, id]
    );

    console.log('✅ Profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('❌ Update user error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update profile', 
      error: error.message 
    });
  }
});

module.exports = router;
