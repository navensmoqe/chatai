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

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('حجم الملف كبير جداً. الحد الأقصى هو 5 ميجابايت.');
        fileInput.value = '';
        return;
    }

    uploadedFile = file;
    filePreview.innerHTML = '';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            requestAnimationFrame(() => {
                filePreview.appendChild(img);
            });
        };
        reader.readAsDataURL(file);
    } else {
        const docElement = document.createElement('div');
        docElement.className = 'document';
        docElement.textContent = file.name;
        requestAnimationFrame(() => {
            filePreview.appendChild(docElement);
        });
    }
});

function formatMessage(content) {
    // تحديد الأكواد البرمجية المحاطة بعلامات ```
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
    let formattedContent = content;
    
    // استبدال كل كتلة كود بمربع كود منسق
    formattedContent = formattedContent.replace(codeBlockRegex, (match, language = '', code) => {
        return `<div class="code-block">
            <div class="code-header">
                <span class="code-language">${language || 'text'}</span>
                <button class="code-copy-btn" onclick="copyCode(this)">
                    <span class="icon">📋</span>
                    نسخ
                </button>
            </div>
            <pre class="code-content">${code.trim()}</pre>
        </div>`;
    });

    // معالجة باقي التنسيقات
    return formattedContent
        .replace(/\*\s?\*{2}([^*:]+):\*{0,2}/g, '<span class="highlighted-text">$1:</span>')
        .replace(/\*([^*]+)\*\*\*/g, '<span class="highlighted-text">$1</span>')
        // معالجة الروابط URL
        .replace(/(?:https?:\/\/)?[\w\-~]+(\.[\w\-~]+)+(\/[\w\-~]*)*(\?[^\s]*)?/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>')
        // المحافظة على مسافات السطور الجديدة
        .replace(/\n/g, '<br>');
}

// إضافة وظيفة نسخ الكود
window.copyCode = function(button) {
    const codeBlock = button.closest('.code-block');
    const codeContent = codeBlock.querySelector('.code-content').textContent;
    
    navigator.clipboard.writeText(codeContent).then(() => {
        button.innerHTML = '<span class="icon">✓</span> تم النسخ';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.innerHTML = '<span class="icon">📋</span> نسخ';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('فشل نسخ النص:', err);
    });
};

// Add message to chat
function addMessage(content, isUser = false) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${isUser ? 'user-message-container' : 'ai-message-container'}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = formatMessage(content);
    messageDiv.dir = 'rtl';
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '<span class="icon">📋</span> نسخ';
    copyButton.title = 'نسخ النص';
    
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(content);
            copyButton.classList.add('copied');
            copyButton.innerHTML = '<span class="icon">✓</span> تم النسخ';
            
            setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.innerHTML = '<span class="icon">📋</span> نسخ';
            }, 2000);
        } catch (err) {
            console.error('فشل نسخ النص:', err);
        }
    });

    messageContainer.appendChild(messageDiv);
    messageContainer.appendChild(copyButton);
    chatMessages.appendChild(messageContainer);
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
            debouncedSaveChats();
            debouncedRenderChatList();
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

// تحسين أداء معالجة الرسائل
let messageQueue = [];
let isProcessing = false;

async function handleSend() {
    const message = userInput.value.trim();
    if ((!message && !uploadedFile) || isProcessing) return;

    try {
        isProcessing = true;
        sendBtn.disabled = true;
        sendBtn.classList.add('processing');
        sendBtn.textContent = 'جاري المعالجة';

        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'جاري التفكير';
        chatMessages.appendChild(loadingIndicator);

        userInput.value = '';
        
        let fullMessage = message;
        if (uploadedFile) {
            const fileAnalysis = await analyzeFile(uploadedFile);
            fullMessage = fileAnalysis;
            addMessage(`تحليل الملف: ${uploadedFile.name}`, true);
            uploadedFile = null;
            filePreview.innerHTML = '';
        } else {
            addMessage(message, true);
        }

        const aiResponse = await sendToAI(fullMessage);
        loadingIndicator.remove();
        addMessage(aiResponse);

    } catch (error) {
        console.error('Error in handleSend:', error);
        addMessage("عذراً، حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.", false);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('processing');
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

// تحسين أداء الذاكرة من خلال تحديد حد أقصى للرسائل المحفوظة
const MAX_MESSAGES_PER_CHAT = 50;
const MAX_CHATS = 20;

function saveChats() {
    // حذف الدردشات القديمة إذا تجاوز العدد الحد الأقصى
    if (chats.length > MAX_CHATS) {
        chats = chats.slice(0, MAX_CHATS);
    }
    
    // تقليص عدد الرسائل في كل دردشة
    chats.forEach(chat => {
        if (chat.messages.length > MAX_MESSAGES_PER_CHAT) {
            chat.messages = chat.messages.slice(-MAX_MESSAGES_PER_CHAT);
        }
    });
    
    localStorage.setItem('chats', JSON.stringify(chats));
}

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

function renderChatList() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        
        const chatContent = document.createElement('div');
        chatContent.className = 'chat-content';
        chatContent.innerHTML = `
            <div class="chat-title">${chat.title}</div>
            <div class="chat-preview">${chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.substring(0, 30) + '...' : 'دردشة جديدة'}</div>
        `;
        chatContent.onclick = () => loadChat(chat.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'حذف الدردشة';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('هل أنت متأكد من حذف هذه الدردشة؟')) {
                deleteChat(chat.id);
            }
        };
        
        chatElement.appendChild(chatContent);
        chatElement.appendChild(deleteBtn);
        chatList.appendChild(chatElement);
    });
}

function deleteChat(chatId) {
    chats = chats.filter(chat => chat.id !== chatId);
    saveChats();
    
    if (chatId === currentChatId) {
        if (chats.length > 0) {
            loadChat(chats[0].id);
        } else {
            createNewChat();
        }
    } else {
        renderChatList();
    }
}

// تحسين أداء تحميل الدردشة
function loadChat(chatId) {
    if (currentChatId === chatId) return;
    
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (chat) {
        requestAnimationFrame(() => {
            chatMessages.innerHTML = '';
            chat.messages.forEach(msg => {
                addMessage(msg.content, msg.isUser);
            });
            renderChatList();
        });
    }
}

// Add button for toggle sidebar on mobile
const menuBtn = document.createElement('button');
menuBtn.className = 'menu-btn';
menuBtn.innerHTML = '☰';
menuBtn.onclick = toggleSidebar;
document.querySelector('.header-controls').appendChild(menuBtn); // تغيير من prepend إلى appendChild

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

// إضافة التخزين المؤقت للصور
const imageCache = new Map();

function loadAndCacheImage(src) {
    if (imageCache.has(src)) {
        return imageCache.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });

    imageCache.set(src, promise);
    return promise;
}

// تحسين أداء قائمة الدردشات
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedRenderChatList = debounce(renderChatList, 100);
const debouncedSaveChats = debounce(saveChats, 300);

// تحسين معالجة التمرير
chatMessages.addEventListener('scroll', debounce(() => {
    // تحسين أداء التمرير
}, 50));

// تنظيف الذاكرة المؤقتة عند الخروج
window.addEventListener('beforeunload', () => {
    imageCache.clear();
});
