/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

const chatContainer = document.getElementById('chat-history') as HTMLDivElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const promptStartersContainer = document.getElementById('prompt-starters') as HTMLDivElement;


let chat: Chat;

// --- Helper Functions for Context-Aware Chat ---


/**
 * Generates the initial chatbot message.
 * @returns The initial message string in Markdown format.
 */
function generateInitialMessage(): string {
    return `
Mức giá 28.000đ cho dịch vụ **Siêu tốc** của Ahamove tuy cao hơn một chút so với mặt bằng chung (~25.000đ), nhưng đây là mức phí hoàn toàn hợp lý để đổi lấy **tốc độ vượt trội, tài xế chuyên nghiệp và sự đảm bảo an toàn cho đơn hàng của bạn.**

Bạn có muốn biết thêm về các ưu điểm khác của dịch vụ này không, hay muốn so sánh với các lựa chọn khác ạ?
    `;
}

/**
 * Builds the system instruction for the AI.
 * @param knowledgeBase The base knowledge from the text file.
 * @returns The complete system instruction string.
 */
function buildSystemInstruction(knowledgeBase: string): string {
    return `
Bạn là một chuyên gia tư vấn bán hàng thông minh và thuyết phục của 'Ahamove',
một ứng dụng giao hàng chuyên nghiệp. Mục tiêu của bạn là hiểu rõ nhu cầu
giao hàng của người dùng, sau đó sử dụng kiến thức sâu sắc về dịch vụ và giá cả
để thuyết phục họ rằng Ahamove là lựa chọn tối ưu nhất.

**KIẾN THỨC CỐT LÕI CỦA BẠN:**
${knowledgeBase}

**QUY TRÌNH TƯ VẤN:**
1.  **Lắng nghe:** Hiểu rõ yêu cầu của khách: cần giao gấp, ưu tiên giá rẻ, hàng cồng kềnh, v.v.
2.  **So sánh & Phân tích:** Dựa vào bảng giá, hãy so sánh một cách khéo léo dịch vụ của Ahamove với các đối thủ. Nhấn mạnh lợi thế cạnh tranh của Ahamove.
3.  **Tư vấn linh hoạt:** Đây là kỹ năng quan trọng nhất. Dựa vào nhu cầu, hãy chủ động đề xuất dịch vụ phù hợp. Nếu khách cần giao gấp, hãy gợi ý 'Siêu tốc'. Nếu khách ưu tiên giá rẻ, hãy gợi ý 'Trong ngày'.
4.  **Thuyết phục:** Luôn giữ thái độ thân thiện, đồng cảm và chốt lại bằng cách khẳng định những lợi ích vượt trội khi chọn Ahamove.

**PHONG CÁCH TRẢ LỜI:**
- **Ưu tiên sự ngắn gọn:** Khi trả lời các câu hỏi từ gợi ý (ví dụ: "So sánh giá với hãng khác?") hoặc các câu hỏi chung, hãy đưa ra câu trả lời trực tiếp và ngắn gọn trước.
- **Cung cấp chi tiết khi được yêu cầu:** Chỉ đi sâu vào phân tích chi tiết, đưa ra nhiều ví dụ, hoặc tư vấn các lựa chọn thay thế khi người dùng hỏi thêm hoặc yêu cầu cụ thể. Mục tiêu là không làm người dùng bị "ngợp" thông tin ở câu trả lời đầu tiên.
`;
}


// --- Core Application Logic ---

async function initializeChat() {
  try {
    // 1. Fetch the external knowledge base
    const response = await fetch('strong-points.txt');
    if (!response.ok) {
        throw new Error('Không thể tải tệp strong-points.txt');
    }
    const knowledgeBase = await response.text();

    // 2. Build the system instruction and initial message
    const systemInstruction = buildSystemInstruction(knowledgeBase);
    const initialMessage = generateInitialMessage();

    // 3. Initialize the AI model with the static configuration
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
      },
    });

    // 4. Display the generated initial message
    appendMessage(initialMessage, 'model');

  } catch (error) {
    console.error('Initialization failed:', error);
    appendMessage('Lỗi: Không thể khởi tạo cuộc trò chuyện AI. Vui lòng kiểm tra API key và làm mới trang.', 'model');
    setFormDisabled(true);
  }
}

function initializePromptStarters() {
    promptStartersContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            const promptText = target.textContent;
            if (promptText) {
                chatInput.value = promptText;
                chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = chatInput.value.trim();

  if (!userMessage) return;

  promptStartersContainer.style.display = 'none'; // Hide starters after first message
  appendMessage(userMessage, 'user');
  chatInput.value = '';
  setFormDisabled(true);

  await streamResponse(userMessage);
  setFormDisabled(false);
  chatInput.focus();
});

async function streamResponse(message: string) {
  const modelMessageDiv = appendMessage('', 'model');
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = '<div class="spinner"></div><span>Đang suy nghĩ...</span>';
  modelMessageDiv.appendChild(loadingIndicator);
  
  let fullResponse = '';
  try {
    const responseStream = await chat.sendMessageStream({ message });

    for await (const chunk of responseStream) {
      if (loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }
      fullResponse += chunk.text;
      modelMessageDiv.innerHTML = await marked.parse(fullResponse);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  } catch (error) {
    console.error('Error streaming response:', error);
    modelMessageDiv.innerHTML = 'Rất tiếc, tôi đã gặp lỗi. Vui lòng thử lại.';
  }
}

function appendMessage(text: string, sender: 'user' | 'model'): HTMLDivElement {
  const messageWrapper = document.createElement('div');
  messageWrapper.className = `message ${sender}-message`;

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';

  if (text) {
    // FIX: The `marked.parse` method can return either a string or a Promise.
    // To handle both cases, we wrap the result in `Promise.resolve()` to
    // ensure we can safely call `.then()`.
    Promise.resolve(marked.parse(text)).then(html => {
        messageContent.innerHTML = html;
    });
  }
  
  messageWrapper.appendChild(messageContent);
  chatContainer.appendChild(messageWrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return messageContent;
}

function setFormDisabled(disabled: boolean) {
  chatInput.disabled = disabled;
  sendButton.disabled = disabled;
}

// Initialize the application
initializeChat();
initializePromptStarters();