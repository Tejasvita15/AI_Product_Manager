const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_URL = 'https://api.groq.com/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Helper function to calculate checklist completion percentage
const calculateChecklistPercentage = (checklist) => {
  const totalItems = checklist.length;
  const completedItems = checklist.filter(item => item.status === 'completed').length;
  return Math.round((completedItems / totalItems) * 100);
};

// Sample checklist template
const generateSampleChecklist = (featureIdea) => {
  return [
    {
      category: "Bias and Fairness",
      item: "Data Bias Assessment",
      description: `Evaluate potential biases in the ${featureIdea} feature's data processing and outcomes`,
      importance: 5,
      status: "pending",
      recommendations: "Conduct regular bias audits and implement fairness metrics"
    },
    {
      category: "Privacy and Data Protection",
      item: "Data Collection Review",
      description: `Review all data collection points in the ${featureIdea} feature`,
      importance: 5,
      status: "pending",
      recommendations: "Implement data minimization and ensure GDPR compliance"
    },
    {
      category: "Transparency",
      item: "Algorithm Explainability",
      description: `Ensure the ${featureIdea} feature's decision-making process is transparent`,
      importance: 4,
      status: "pending",
      recommendations: "Implement explainable AI techniques and user-friendly explanations"
    },
    {
      category: "Safety and Security",
      item: "Security Assessment",
      description: `Conduct security analysis of the ${featureIdea} feature`,
      importance: 5,
      status: "pending",
      recommendations: "Implement encryption and regular security audits"
    }
  ];
};

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
      }
    );

    const message = response.data.choices[0].message.content;
    res.json({ response: message });
  } catch (error) {
    console.error('Groq API error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate response from Groq' });
  }
});

app.post('/generate-checklist', async (req, res) => {
  const { featureIdea } = req.body;

  if (!featureIdea) {
    return res.status(400).json({ error: 'Feature idea is required' });
  }

  const checklistPrompt = `Create an ethical AI checklist for: "${featureIdea}"
  
  Return ONLY a JSON array with objects in this EXACT format:
  [
    {
      "category": "Category Name",
      "item": "Specific Item to Check",
      "description": "Detailed Explanation",
      "importance": 5,
      "status": "pending",
      "recommendations": "Specific Actions"
    }
  ]

  Include items for:
  - Bias and fairness assessment
  - Privacy and data protection
  - Transparency and explainability
  - Safety and security measures
  - Environmental impact considerations
  - Social impact evaluation
  - User rights and autonomy
  - Regulatory compliance

  Keep descriptions concise and specific to ${featureIdea}.`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'mixtral-8x7b-32768',
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI ethics expert. Respond only with valid JSON arrays containing checklist items.' 
          },
          { 
            role: 'user', 
            content: checklistPrompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
      }
    );

    let checklist;
    try {
      // Try to parse the response as JSON
      const content = response.data.choices[0].message.content;
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      checklist = JSON.parse(jsonStr);
      
      // Validate checklist structure
      if (!Array.isArray(checklist) || checklist.length === 0) {
        throw new Error('Invalid checklist format');
      }

      // Ensure all items have required fields
      checklist = checklist.map(item => ({
        category: item.category || 'Uncategorized',
        item: item.item || 'Unnamed Item',
        description: item.description || 'No description provided',
        importance: Number(item.importance) || 3,
        status: 'pending',
        recommendations: item.recommendations || 'No recommendations provided'
      }));

    } catch (parseError) {
      console.error('Failed to parse AI response, using sample checklist:', parseError);
      // Fall back to sample checklist if parsing fails
      checklist = generateSampleChecklist(featureIdea);
    }

    const percentage = calculateChecklistPercentage(checklist);

    res.json({
      checklist,
      percentage,
      totalItems: checklist.length
    });
  } catch (error) {
    console.error('Checklist generation error:', error?.response?.data || error.message);
    // Fall back to sample checklist on API error
    const checklist = generateSampleChecklist(featureIdea);
    res.json({
      checklist,
      percentage: 0,
      totalItems: checklist.length
    });
  }
});

// Update checklist item status
app.post('/update-checklist-item', (req, res) => {
  const { itemIndex, status, checklist } = req.body;

  try {
    const updatedChecklist = [...checklist];
    updatedChecklist[itemIndex].status = status;

    const percentage = calculateChecklistPercentage(updatedChecklist);

    res.json({
      checklist: updatedChecklist,
      percentage,
      totalItems: updatedChecklist.length
    });
  } catch (error) {
    console.error('Checklist update error:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
