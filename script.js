/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

const workerUrl = "https://wanderbot-worker.jmontg25.workers.dev/";
const openaiKey = typeof OPENAI_API_KEY !== "undefined" ? OPENAI_API_KEY : null;

// Conversation state
const messages = [
  {
    role: "system",
    content:
      "You are L'Oréal Smart Product Advisor. Only answer questions related to L'Oréal products, routines, recommendations, ingredients, and beauty topics. If a user asks about unrelated topics, politely refuse and steer them back to beauty/product topics. Be concise, friendly, and provide product suggestions across makeup, skincare, haircare, and fragrance. When appropriate, ask one clarifying question.",
  },
];

// Set initial message visible in chat window
function renderInitial() {
  chatWindow.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.className = "msg ai";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent =
    "👋 Hello! I'm the L'Oréal Smart Product Advisor. Ask me about products, routines, or recommendations.";
  welcome.appendChild(bubble);
  chatWindow.appendChild(welcome);
  scrollToBottom();
}

renderInitial();

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderMessage(role, text, showLatestQuestion = false) {
  // If showLatestQuestion is true, display user's question above assistant response
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  if (role === "ai" && showLatestQuestion) {
    const latest = document.createElement("div");
    latest.className = "latest-question";
    // Find last user message in messages array
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    latest.textContent = lastUser
      ? `You asked: ${lastUser.content}`
      : "You asked:";
    chatWindow.appendChild(latest);
  }
  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  scrollToBottom();
}

async function callWorker(payload) {
  if (!workerUrl && !openaiKey) {
    throw new Error(
      "No WORKER_URL or OPENAI_API_KEY configured. Add one in secrets.js or deploy a Cloudflare Worker."
    );
  }

  if (workerUrl) {
    const resp = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    // Worker should proxy OpenAI response format: data.choices[0].message.content
    if (data?.choices?.[0]?.message?.content)
      return data.choices[0].message.content;
    // fallback to raw text
    if (data?.text) return data.text;
    return JSON.stringify(data);
  }

  // Local direct call to OpenAI API (FOR TESTING ONLY)
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages: payload.messages }),
  });
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
}

// Disable/enable form
function setLoading(isLoading) {
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = isLoading;
  if (isLoading) sendBtn.style.opacity = "0.6";
  else sendBtn.style.opacity = "1";
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Append user message to UI and messages history
  messages.push({ role: "user", content: text });
  renderMessage("user", text);
  userInput.value = "";

  // Show a loading assistant bubble
  renderMessage("ai", "…thinking…");
  setLoading(true);

  try {
    const payload = { messages };
    const assistantText = await callWorker(payload);

    // Remove the temporary thinking bubble (last .ai)
    const aiBubbles = chatWindow.querySelectorAll(".msg.ai");
    if (aiBubbles.length > 0) {
      const last = aiBubbles[aiBubbles.length - 1];
      last.remove();
    }

    // Add assistant message to history and render with latest question shown
    messages.push({ role: "assistant", content: assistantText });
    renderMessage("ai", assistantText, true);
  } catch (err) {
    // Replace thinking bubble with error
    const aiBubbles2 = chatWindow.querySelectorAll(".msg.ai");
    if (aiBubbles2.length > 0) aiBubbles2[aiBubbles2.length - 1].remove();
    renderMessage(
      "ai",
      "Sorry — I'm having trouble reaching the server. Check your Worker URL or API key."
    );
    console.error(err);
  } finally {
    setLoading(false);
  }
});

// Allow pressing Enter to submit (already handled by form) and focus state
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

