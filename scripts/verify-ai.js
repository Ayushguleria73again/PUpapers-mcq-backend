require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error("No API Key"); process.exit(1); }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const result = await model.generateContent("Hello");
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Failure:", err.message);
  }
}

checkAI();
