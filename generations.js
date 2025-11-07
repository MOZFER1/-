/**
 * ========================================
 * GENERATIONS ROUTES
 * ========================================
 * 
 * This file handles generation tracking using the existing 'content' table.
 * 
 * Features:
 * - Check if user can generate content (based on daily limit)
 * - Track each generation in the content table
 * - Enforce 5 generations/day for free users
 * - Unlimited generations for premium users
 * 
 * Endpoints:
 * - GET  /api/generations/can-generate/:userId
 * - POST /api/generations/increment
 * - GET  /api/generations/count/:userId
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * ========================================
 * GET /api/generations/can-generate/:userId
 * ========================================
 * 
 * Checks if user can generate content based on:
 * - Subscription type (premium = unlimited)
 * - Daily generation count (free = 5 max per day)
 * 
 * @param {number} userId - User ID from URL parameter
 * @returns {object} { canGenerate: boolean, remaining: number, subscriptionType: string }
 */
router.get('/can-generate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 Checking generation limit for user:', userId);

    // Step 1: Get user's subscription status
    const [subscriptions] = await db.query(
      `SELECT s.SubscriptionID, s.Status, s.EndDate
       FROM subscription s
       WHERE s.UserID = ? AND s.Status = 'active'
       ORDER BY s.EndDate DESC
       LIMIT 1`,
      [userId]
    );

    // Check if user is premium (active subscription with valid end date)
    const subscription = subscriptions[0];
    const isPremium = subscription && new Date(subscription.EndDate) > new Date();

    // If premium, allow unlimited generations
    if (isPremium) {
      console.log('⭐ Premium user - unlimited generations');
      return res.json({
        success: true,
        canGenerate: true,
        subscriptionType: 'premium',
        remaining: 'unlimited',
        used: 0,
        limit: 999999,
        message: 'Premium user has unlimited generations'
      });
    }

    // Step 2: For free users, count today's generations from content table
    // Using DateCreated field to check today's date
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS count 
       FROM content 
       WHERE OwnerID = ? AND DATE(DateCreated) = CURDATE()`,
      [userId]
    );

    const todayCount = countResult[0].count;
    const limit = 5; // Free user daily limit
    const remaining = Math.max(0, limit - todayCount);
    const canGenerate = todayCount < limit;

    console.log(`📊 Free user generations: ${todayCount}/${limit} (remaining: ${remaining})`);

    res.json({
      success: true,
      canGenerate,
      subscriptionType: 'free',
      used: todayCount,
      limit: limit,
      remaining: remaining,
      message: canGenerate 
        ? `You have ${remaining} generations remaining today`
        : 'Daily limit reached. Upgrade to Premium for unlimited generations!'
    });

  } catch (error) {
    console.error('❌ Error checking generation limit:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check generation limit',
      error: error.message
    });
  }
});

/**
 * ========================================
 * POST /api/generations/increment
 * ========================================
 * 
 * This endpoint is called AFTER successful generation.
 * It's already handled by /api/content/save, so this is just for compatibility.
 * 
 * @param {number} userId - User ID from request body
 * @param {string} type - Generation type (image/video)
 * @returns {object} { success: boolean, todayCount: number }
 */
router.post('/increment', async (req, res) => {
  try {
    const { userId, type } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    console.log(`✅ Generation increment requested for User ${userId}, Type: ${type}`);

    // Get updated count for today from content table
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS count 
       FROM content 
       WHERE OwnerID = ? AND DATE(DateCreated) = CURDATE()`,
      [userId]
    );

    const todayCount = countResult[0].count;
    const remaining = Math.max(0, 5 - todayCount);

    console.log(`📊 Current count: ${todayCount}/5 (remaining: ${remaining})`);

    res.json({
      success: true,
      message: 'Count retrieved successfully',
      todayCount: todayCount,
      limit: 5,
      remaining: remaining
    });

  } catch (error) {
    console.error('❌ Error in increment:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get generation count',
      error: error.message
    });
  }
});

/**
 * ========================================
 * GET /api/generations/count/:userId
 * ========================================
 * 
 * Get today's generation count for a user from content table
 * 
 * @param {number} userId - User ID from URL parameter
 * @returns {object} { count: number, limit: number, remaining: number }
 */
router.get('/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get today's count from content table
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS count 
       FROM content 
       WHERE OwnerID = ? AND DATE(DateCreated) = CURDATE()`,
      [userId]
    );

    const todayCount = countResult[0].count;
    const limit = 5;
    const remaining = Math.max(0, limit - todayCount);

    res.json({
      success: true,
      count: todayCount,
      limit: limit,
      remaining: remaining
    });

  } catch (error) {
    console.error('❌ Error getting count:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get generation count',
      error: error.message
    });
  }
});

/**
 * ========================================
 * DELETE /api/generations/reset-daily
 * ========================================
 * 
 * This endpoint is called by cron job to reset daily counts.
 * With the content table approach, we don't need to delete anything.
 * The count is automatically "reset" because we query by DATE(DateCreated) = CURDATE()
 * 
 * This endpoint is kept for manual testing/admin purposes only.
 */
router.post('/reset-daily', async (req, res) => {
  try {
    console.log('🔄 Daily reset called (no action needed - using date-based counting)');
    
    res.json({
      success: true,
      message: 'Daily counts automatically reset at midnight based on date queries'
    });

  } catch (error) {
    console.error('❌ Error in reset:', error.message);
    res.status(500).json({
      success: false,
      message: 'Reset failed',
      error: error.message
    });
  }
});

module.exports = router;
