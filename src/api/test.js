const express = require('express');
const OpenAI = require('openai');
const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key-for-development'
});

// Log OpenAI client info
console.log('OpenAI client initialized');

// Test endpoint to verify assistant exists (NO AUTHENTICATION REQUIRED)
router.get('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    console.log('Testing assistant:', assistantId);
    
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    console.log('Assistant found:', assistant.name);
    
    res.json({ 
      success: true, 
      assistant: {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        instructions: assistant.instructions?.substring(0, 100) + '...'
      }
    });
  } catch (error) {
    console.error('Error retrieving assistant:', error);
    res.json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || error
    });
  }
});

// Test creating a thread
router.get('/thread', async (req, res) => {
  try {
    console.log('Creating test thread...');
    const thread = await openai.beta.threads.create();
    console.log('Thread created:', thread.id);
    
    res.json({ 
      success: true, 
      threadId: thread.id 
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test listing runs
router.post('/list-runs', async (req, res) => {
  try {
    const { threadId } = req.body;
    console.log('Listing runs for thread:', threadId);
    
    const runs = await openai.beta.threads.runs.list(threadId);
    console.log('Runs found:', runs.data.length);
    
    res.json({ 
      success: true, 
      runs: runs.data.map(run => ({
        id: run.id,
        status: run.status,
        created_at: run.created_at
      }))
    });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test the full flow
router.post('/full-test', async (req, res) => {
  try {
    const { assistantId, message } = req.body;
    
    // Create thread
    console.log('1. Creating thread...');
    const thread = await openai.beta.threads.create();
    console.log('Thread created:', thread.id);
    
    // Add message
    console.log('2. Adding message...');
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message || 'Hello, test message'
    });
    
    // Create run
    console.log('3. Creating run...');
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });
    console.log('Run created:', run.id);
    
    // Check run status
    console.log('4. Checking run status...');
    console.log('About to retrieve with:', { threadId: thread.id, runId: run.id });
    console.log('Type of thread.id:', typeof thread.id, 'Value:', thread.id);
    
    // Declare runStatus outside try block for proper scoping
    let runStatus;
    
    // Try different approaches to see which one works
    try {
      // Approach 1: Using correct format with thread_id in params
      console.log('Trying approach 1: runId with thread_id in params');
      runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
      console.log('Run status:', runStatus.status);
    } catch (error1) {
      console.error('Approach 1 failed:', error1.message);
      
      try {
        // Approach 2: Swapped parameters (maybe run_id comes first?)
        console.log('Trying approach 2: Swapped parameters');
        const runStatus = await openai.beta.threads.runs.retrieve(run.id, thread.id);
        console.log('Run status:', runStatus.status);
      } catch (error2) {
        console.error('Approach 2 failed:', error2.message);
        
        try {
          // Approach 3: Using the full path
          console.log('Trying approach 3: Full path method');
          const runStatus = await openai.beta.threads.runs.retrieve(
            `threads/${thread.id}/runs/${run.id}`
          );
          console.log('Run status:', runStatus.status);
        } catch (error3) {
          console.error('Approach 3 failed:', error3.message);
          
          // Log the actual thread and run objects to see their structure
          console.log('Thread object:', JSON.stringify(thread, null, 2));
          console.log('Run object:', JSON.stringify(run, null, 2));
          
          throw new Error('All approaches failed to retrieve run status');
        }
      }
    }
    
    res.json({ 
      success: true,
      threadId: thread.id,
      runId: run.id,
      status: runStatus.status
    });
  } catch (error) {
    console.error('Error in full test:', error);
    res.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;