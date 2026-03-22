import { config } from "dotenv";
config({ path: ".env.local" });

async function testAPIs() {
  console.log("Testing API keys...\n");

  // Test Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    console.log("Testing Anthropic...");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 50,
          messages: [{ role: "user", content: "Say hello in 3 words" }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Anthropic: Working");
        console.log(`   Response: ${data.content[0].text}\n`);
      } else {
        console.log("❌ Anthropic: Error", await response.text());
      }
    } catch (e) {
      console.log("❌ Anthropic: Error", e);
    }
  } else {
    console.log("⚠️ Anthropic: No API key\n");
  }

  // Test OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    console.log("Testing OpenAI...");
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 50,
          messages: [{ role: "user", content: "Say hello in 3 words" }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ OpenAI: Working");
        console.log(`   Response: ${data.choices[0].message.content}\n`);
      } else {
        console.log("❌ OpenAI: Error", await response.text());
      }
    } catch (e) {
      console.log("❌ OpenAI: Error", e);
    }
  } else {
    console.log("⚠️ OpenAI: No API key\n");
  }

  // Test Google
  const googleKey = process.env.GOOGLE_AI_API_KEY;
  if (googleKey) {
    console.log("Testing Google...");
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Say hello in 3 words" }] }],
            generationConfig: { maxOutputTokens: 50 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Google: Working");
        console.log(`   Response: ${data.candidates[0].content.parts[0].text}\n`);
      } else {
        console.log("❌ Google: Error", await response.text());
      }
    } catch (e) {
      console.log("❌ Google: Error", e);
    }
  } else {
    console.log("⚠️ Google: No API key\n");
  }

  console.log("Done!");
}

testAPIs();
