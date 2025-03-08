const API_KEY = 'AIzaSyALucE2HCAuhJ6z8sJQK-a2sPtLT5tLqZI';
const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const newChatBtn = document.getElementById('newChatBtn');
const toggleThemeBtn = document.getElementById('toggleThemeBtn');

let uploadedFile = null;

// Handle file uploads
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadedFile = file;
    filePreview.innerHTML = '';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            filePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else {
        const docElement = document.createElement('div');
        docElement.className = 'document';
        docElement.textContent = file.name;
        filePreview.appendChild(docElement);
    }
});

// Add message to chat
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Save message to current chat
    if (currentChatId) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            chat.messages.push({ content, isUser });
            if (isUser && chat.messages.length === 1) {
                // Update chat title with first user message
                chat.title = content.substring(0, 30);
            }
            saveChats();
            renderChatList();
        }
    }
}

// Handle file analysis
async function analyzeFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (file.type.startsWith('image/')) {
                const base64Image = e.target.result.split(',')[1];
                resolve({
                    text: `قم بتحليل هذه الصورة ووصف ما تراه فيها بالتفصيل باللغة العربية: ${file.name}`,
                    image: base64Image
                });
            } else {
                resolve({
                    text: `تم رفع المستند: ${file.name}. هل يمكنك تحليل محتواه باللغة العربية؟`
                });
            }
        };
        reader.readAsDataURL(file);
    });
}

// Send message to API
async function sendToAI(message) {
    try {
        let parts = [];
        
        // Handle text messages
        if (typeof message === 'string') {
            parts.push({
                text: message
            });
        } 
        // Handle messages with images
        else if (typeof message === 'object') {
            if (message.text) {
                parts.push({
                    text: message.text + " الرجاء الرد باللغة العربية."
                });
            }
            if (message.image) {
                parts.push({
                    inlineData: {
                        mimeType: uploadedFile.type,
                        data: message.image
                    }
                });
            }
        }

        const requestBody = {
            contents: [{
                parts: parts
            }],
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 32,
                topP: 1,
                maxOutputTokens: 2048,
                stopSequences: []
            }
        };

        console.log('Sending request to Gemini API...');

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(`خطأ في الاتصال: ${errorData.error?.message || 'خطأ غير معروف'}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (data.candidates && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            return `عذراً، لا يمكن معالجة هذا المحتوى: ${data.promptFeedback.blockReason}`;
        } else {
            throw new Error('تنسيق الاستجابة غير صالح');
        }
    } catch (error) {
        console.error('Error details:', error);
        return `عذراً، حدث خطأ أثناء معالجة طلبك: ${error.message}`;
    }
}

// Handle sending messages
async function handleSend() {
    const message = userInput.value.trim();
    if (!message && !uploadedFile) return;

    try {
        // Show loading state
        sendBtn.disabled = true;
        sendBtn.textContent = 'جاري المعالجة...';

        let fullMessage = message;

        // If there's a file uploaded, analyze it first
        if (uploadedFile) {
            const fileAnalysis = await analyzeFile(uploadedFile);
            fullMessage = fileAnalysis;
            
            // Add user message to chat
            addMessage(`تحليل الملف: ${uploadedFile.name}`, true);
        } else {
            // Add user message to chat
            addMessage(message, true);
        }

        // Clear input
        userInput.value = '';

        // Process message
        const aiResponse = await sendToAI(fullMessage);
        
        // Clear file preview and uploaded file after getting response
        if (uploadedFile) {
            uploadedFile = null;
            filePreview.innerHTML = '';
        }
        
        // Add AI response
        addMessage(aiResponse);
    } catch (error) {
        console.error('Error in handleSend:', error);
        addMessage("عذراً، حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.", false);
    } finally {
        // Reset button state
        sendBtn.disabled = false;
        sendBtn.textContent = 'إرسال';
    }
}

// Theme handling
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

// New chat handling
function startNewChat() {
    chatMessages.innerHTML = '';
    userInput.value = '';
    filePreview.innerHTML = '';
    uploadedFile = null;
    createNewChat();
}

// Add event listeners for new buttons
newChatBtn.addEventListener('click', startNewChat);
toggleThemeBtn.addEventListener('click', toggleTheme);

// Event listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

// Chat history management
const chatList = document.getElementById('chatList');
let chats = JSON.parse(localStorage.getItem('chats') || '[]');
let currentChatId = null;

function createNewChat() {
    const chatId = Date.now().toString();
    const newChat = {
        id: chatId,
        title: 'دردشة جديدة',
        messages: [],
        timestamp: new Date().toISOString()
    };
    chats.unshift(newChat);
    currentChatId = chatId;
    saveChats();
    renderChatList();
    return chatId;
}

function saveChats() {
    localStorage.setItem('chats', JSON.stringify(chats));
}

function renderChatList() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        chatElement.innerHTML = `
            <div class="chat-title">${chat.title}</div>
            <div class="chat-preview">${chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.substring(0, 30) + '...' : 'دردشة جديدة'}</div>
        `;
        chatElement.onclick = () => loadChat(chat.id);
        chatList.appendChild(chatElement);
    });
}

function loadChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chatMessages.innerHTML = '';
        chat.messages.forEach(msg => {
            addMessage(msg.content, msg.isUser);
        });
        renderChatList();
    }
}

// Add button for toggle sidebar on mobile
const menuBtn = document.createElement('button');
menuBtn.className = 'menu-btn';
menuBtn.innerHTML = '☰';
menuBtn.onclick = toggleSidebar;
document.querySelector('.header-controls').prepend(menuBtn);

// Create overlay element
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

// Get close button
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

// Update toggleSidebar function
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

// Close sidebar function
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
}

// Event listeners for closing sidebar
closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// Close sidebar on mobile when clicking a chat item
chatList.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
});

// Initialize first chat if none exists
if (chats.length === 0) {
    createNewChat();
} else {
    currentChatId = chats[0].id;
    loadChat(currentChatId);
}