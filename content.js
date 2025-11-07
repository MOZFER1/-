const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');
const FormData = require('form-data');

// Stability AI API Configuration
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STABILITY_API_URL_ULTRA = 'https://api.stability.ai/v2beta/stable-image/generate/ultra';
const STABILITY_API_URL_SD3 = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

// Get all generated content for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📥 Fetching content for user:', userId);
    
    // Use correct column names: OwnerID, DateCreated
    const [content] = await db.query(
      'SELECT * FROM content WHERE OwnerID = ? ORDER BY DateCreated DESC',
      [userId]
    );

    console.log(`✅ Found ${content.length} content items`);

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('❌ Error fetching content:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get content', 
      error: error.message 
    });
  }
});

// Initialize database (ensure URL column exists)
const initializeDatabase = async () => {
  try {
    // Add URL column if it doesn't exist
    await db.query(`
      ALTER TABLE content 
      ADD COLUMN IF NOT EXISTS URL LONGTEXT AFTER Description
    `);
    console.log('✅ Database initialized - URL column ready');
  } catch (error) {
    console.log('ℹ️  URL column may already exist or not needed');
  }
};

// Run initialization
initializeDatabase();

// Save generated content
router.post('/save', async (req, res) => {
  try {
    const { userId, type, description, url } = req.body;
    console.log('💾 Saving content:', { userId, type, description });

    // Use correct column names: OwnerID, ContentType, Description, Title
    // Title is required, so we'll use a truncated description or type
    const title = description ? description.substring(0, 100) : `Generated ${type}`;

    const [result] = await db.query(
      'INSERT INTO content (Title, OwnerID, ContentType, Description, DateCreated) VALUES (?, ?, ?, ?, NOW())',
      [title, userId, type, description]
    );

    console.log('✅ Content saved with ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Content saved successfully',
      contentId: result.insertId
    });
  } catch (error) {
    console.error('❌ Error saving content:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save content', 
      error: error.message 
    });
  }
});

// Generate content using OpenAI API
router.post('/generate', async (req, res) => {
  try {
    const { userId, type, description } = req.body;

    if (!userId || !type || !description) {
      return res.status(400).json({
        success: false,
        message: 'userId, type, and description are required'
      });
    }

    console.log('🎨 Generating content:', { userId, type, description });

    let generatedUrl = null;

    if (type === 'image') {
      // Generate image using Stability AI
      console.log('🖼️ Generating image with Stability AI...');
      console.log('🔑 API Key:', STABILITY_API_KEY ? 'Found' : 'Missing!');
      
      try {
        const formData = new FormData();
        formData.append('prompt', description);
        formData.append('output_format', 'png');
        // Remove 'none' field that might cause issues

        // Use SD3 for better quality
        const response = await axios.postForm(
          STABILITY_API_URL_SD3,
          formData,
          {
            validateStatus: (status) => status < 500, // Accept 4xx errors for debugging
            responseType: 'arraybuffer',
            headers: { 
              Authorization: `Bearer ${STABILITY_API_KEY}`, 
              Accept: 'image/*' 
            },
          }
        );

        console.log('📡 Stability AI Response Status:', response.status);
        
        if (response.status === 200) {
          // Save image to file and store URL instead of base64
          const fs = require('fs');
          const path = require('path');
          
          // Create uploads directory if it doesn't exist
          const uploadDir = path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          // Generate unique filename
          const filename = `generated_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const filepath = path.join(uploadDir, filename);
          
          // Save image to file
          fs.writeFileSync(filepath, response.data);
          
          // Create accessible URL
          generatedUrl = `/uploads/${filename}`;
          console.log('✅ Image saved to file:', generatedUrl);
        } else {
          // Log error response for debugging
          const errorText = response.data ? response.data.toString() : 'Unknown error';
          console.error('❌ Stability AI Error Response:', errorText);
          throw new Error(`Stability AI returned status ${response.status}: ${errorText}`);
        }
      } catch (stabilityError) {
        console.error('❌ Stability AI Error:', stabilityError.message);
        if (stabilityError.response) {
          console.error('Response:', stabilityError.response.data);
        }
        throw new Error(`Image generation failed: ${stabilityError.message}`);
      }
    } else if (type === 'video') {
      // Note: Video generation placeholder
      console.log('⚠️ Video generation - using placeholder');
      generatedUrl = `https://placehold.co/400x300/764ba2/ffffff?text=${encodeURIComponent('Video: ' + description.substring(0, 30))}`;
    }

    // Save to database with URL
    const title = description.substring(0, 100);
    const [result] = await db.query(
      'INSERT INTO content (Title, OwnerID, ContentType, Description, URL, DateCreated) VALUES (?, ?, ?, ?, ?, NOW())',
      [title, userId, type, description, generatedUrl]
    );

    console.log('💾 Content saved to database with ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Content generated successfully',
      contentId: result.insertId,
      url: generatedUrl,
      description: description,
      type: type
    });

  } catch (error) {
    console.error('❌ Error generating content:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate content',
      error: error.message
    });
  }
});

// Delete generated content
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting content ID:', id);

    // Use correct column name: ContentID
    await db.query('DELETE FROM content WHERE ContentID = ?', [id]);

    console.log('✅ Content deleted successfully');

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting content:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete content', 
      error: error.message 
    });
  }
});

module.exports = router;
