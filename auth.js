const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const [existing] = await db.query(
      'SELECT * FROM registereduser WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Insert new user (In production, hash the password!)
    const [result] = await db.query(
      'INSERT INTO registereduser (username, email, password) VALUES (?, ?, ?)',
      [username, email, password]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed', 
      error: error.message 
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query(
      'SELECT UserID as id, Username as username, Email as email FROM registereduser WHERE Email = ? AND Password = ?',
      [email, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = users[0];

    // Fetch subscription status
    const [subscriptions] = await db.query(
      `SELECT SubscriptionID, UserID, StartDate, EndDate, Status 
       FROM subscription 
       WHERE UserID = ? AND Status = 'active' 
       ORDER BY EndDate DESC LIMIT 1`,
      [user.id]
    );

    const subscription = subscriptions[0];
    const isPremium = subscription && new Date(subscription.EndDate) > new Date();

    // Add subscription info to user object
    user.subscriptionType = isPremium ? 'premium' : 'free';
    user.generationsLimit = isPremium ? 999999 : 5;
    user.generationsToday = 0; // Reset on login (in production, track this in DB)

    res.json({
      success: true,
      message: 'Login successful',
      user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Login failed', 
      error: error.message 
    });
  }
});

module.exports = router;
