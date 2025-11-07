const express = require('express');
const router = express.Router();
const db = require('../config/database');
require('dotenv').config();

// Stripe test mode - no real payments
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key');

// Get user subscription status
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📊 Fetching subscription for user:', userId);
    
    // Query using actual database columns: SubscriptionID, UserID, StartDate, EndDate, Status
    const [subscriptions] = await db.query(
      `SELECT SubscriptionID, UserID, StartDate, EndDate, Status 
       FROM subscription 
       WHERE UserID = ? AND Status = 'active' 
       ORDER BY EndDate DESC LIMIT 1`,
      [userId]
    );

    const subscription = subscriptions[0];
    const isPremium = subscription && new Date(subscription.EndDate) > new Date();

    console.log('✅ Subscription status:', { isPremium, subscription });

    res.json({
      success: true,
      subscription: subscription || null,
      isPremium,
      subscriptionType: isPremium ? 'premium' : 'free'
    });
  } catch (error) {
    console.error('❌ Get subscription error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get subscription', 
      error: error.message 
    });
  }
});

// Create Stripe test checkout session
router.post('/create-checkout', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('💳 Creating test checkout for user:', userId);

    // In test mode, we'll just simulate a successful payment
    // Return a mock session ID
    res.json({
      success: true,
      message: 'Test checkout created',
      sessionId: 'test_session_' + Date.now(),
      testMode: true
    });
  } catch (error) {
    console.error('❌ Checkout creation error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create checkout', 
      error: error.message 
    });
  }
});

// Activate premium subscription (test payment success)
router.post('/activate', async (req, res) => {
  try {
    const { userId, paymentMethod } = req.body;
    console.log('🚀 Activating premium for user:', userId);

    // Set subscription for 30 days from now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Check if user has active subscription
    const [existing] = await db.query(
      'SELECT SubscriptionID FROM subscription WHERE UserID = ? AND Status = "active"',
      [userId]
    );

    let subscriptionId;

    if (existing.length > 0) {
      // Update existing subscription
      subscriptionId = existing[0].SubscriptionID;
      await db.query(
        'UPDATE subscription SET StartDate = ?, EndDate = ?, Status = "active" WHERE SubscriptionID = ?',
        [startDate, endDate, subscriptionId]
      );
      console.log('✅ Updated existing subscription:', subscriptionId);
    } else {
      // Create new subscription
      const [result] = await db.query(
        'INSERT INTO subscription (UserID, StartDate, EndDate, Status) VALUES (?, ?, ?, "active")',
        [userId, startDate, endDate]
      );
      subscriptionId = result.insertId;
      console.log('✅ Created new subscription:', subscriptionId);
    }

    // Record test payment in payment table
    await db.query(
      'INSERT INTO payment (SubscriptionID, Amount, PaymentDate, PaymentMethod, State) VALUES (?, ?, ?, ?, ?)',
      [subscriptionId, 10.00, new Date(), paymentMethod || 'Test Card', 'completed']
    );

    res.json({
      success: true,
      message: 'Premium subscription activated successfully!',
      subscriptionId,
      endDate
    });
  } catch (error) {
    console.error('❌ Activation error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to activate subscription', 
      error: error.message 
    });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('❌ Canceling subscription for user:', userId);

    await db.query(
      'UPDATE subscription SET Status = "cancelled" WHERE UserID = ? AND Status = "active"',
      [userId]
    );

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('❌ Cancel error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel subscription', 
      error: error.message 
    });
  }
});

module.exports = router;
