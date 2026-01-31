require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set in .env");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // There isn't a direct "listModels" on the instance in some SDK versions,
    // but usually it's there. Let's try basic generation with a safe model first/
    // actually checking the documentation, typically checking if a model works is easier.
    
    // Instead of listing (which might not be exposed in this simplified SDK usage),
    // let's try to generate with 'gemini-1.5-flash' and 'gemini-pro' and see which one succeeds.
    
    const modelsToTry = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
    
    console.log("Testing models...");
    
    for (const modelName of modelsToTry) {
        console.log(`\n👉 Testing ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello, are you working?");
            const response = await result.response;
            console.log(`✅ ${modelName} SUCCESS! Response:`, response.text());
        } catch (error) {
            console.error(`❌ ${modelName} FAILED:`, error.message);
        }
    }
    
  } catch (error) {
    console.error("Fatal Error:", error);
  }
}

listModels();
