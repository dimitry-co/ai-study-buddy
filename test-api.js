// Simple test script for the API endpoint
// Run with: node test-api.js
// Make sure your dev server is running first: npm run dev

async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check (GET)...\n');
  try {
    const response = await fetch('http://localhost:3000/api/generate-questions');
    const data = await response.json();
    console.log('✅ Health Check Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
  }
}

async function testGenerateQuestions() {
  console.log('\n🔍 Testing Question Generation (POST)...\n');
  try {
    const response = await fetch('http://localhost:3000/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: 'Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.',
        numberOfQuestions: 3,
        difficulty: 'easy',
        questionType: 'multiple-choice'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Question Generation Successful!');
      console.log(`\n📊 Metadata:`, data.metadata);
      console.log(`\n📝 Generated ${data.questions.length} questions:\n`);
      data.questions.forEach((q, index) => {
        console.log(`${index + 1}. ${q.question}`);
        if (q.options) {
          q.options.forEach(opt => console.log(`   - ${opt}`));
        }
        console.log(`   ✓ Answer: ${q.correctAnswer}\n`);
      });
    } else {
      console.error('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Request Failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Your dev server is running (npm run dev)');
    console.log('   2. You have OPENAI_API_KEY in .env.local');
  }
}

async function testInvalidRequest() {
  console.log('\n🔍 Testing Validation (Empty Notes)...\n');
  try {
    const response = await fetch('http://localhost:3000/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: '',  // Invalid: empty notes
      })
    });
    
    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 400) {
      console.log('✅ Validation working correctly! Rejected empty notes.');
    }
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API Tests...');
  console.log('=' .repeat(60));
  
  await testHealthCheck();
  console.log('\n' + '='.repeat(60));
  
  await testInvalidRequest();
  console.log('\n' + '='.repeat(60));
  
  await testGenerateQuestions();
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ All tests completed!\n');
}

runAllTests();

