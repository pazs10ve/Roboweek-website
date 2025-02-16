import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';

// Sound for new messages
const newMessageSound = new Audio('public\notification sound.mp3'); // Replace with your sound file

const ChatWindow = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [dimensions, setDimensions] = useState({ width: 320, height: 384 });
  const [isResizing, setIsResizing] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const dragControls = useDragControls();
  const intervalsRef = useRef({});
  const resizeData = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle new messages
  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0 && !messages[messages.length - 1].isLoading) {
      newMessageSound.play().catch(() => {}); // Play sound for new messages
    }
  }, [messages]);

  // Handle window resize
  const startResizing = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeData.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
    };
    setIsResizing(true);
  }, [dimensions]);

  const doResize = useCallback((e) => {
    if (!isResizing) return;
    
    const newWidth = Math.max(300, resizeData.current.startWidth + (e.clientX - resizeData.current.startX));
    const newHeight = Math.max(200, resizeData.current.startHeight + (e.clientY - resizeData.current.startY));
    
    setDimensions({
      width: newWidth,
      height: newHeight,
    });
  }, [isResizing]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Typing animation effect
  useEffect(() => {
    messages.forEach((msg, index) => {
      if (msg.role === 'bot' && msg.displayIndex < msg.content.length && !intervalsRef.current[index]) {
        intervalsRef.current[index] = setInterval(() => {
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[index].displayIndex < newMessages[index].content.length) {
              newMessages[index].displayIndex += 1;
              return newMessages;
            }
            clearInterval(intervalsRef.current[index]);
            delete intervalsRef.current[index];
            return prev;
          });
        }, 30);
      }
    });

    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, [messages]);

  // Resize event listeners
  useEffect(() => {
    const handleMouseMove = (e) => doResize(e);
    const handleMouseUp = () => stopResizing();

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, doResize, stopResizing]);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
      setShowScrollButton(scrollHeight - (scrollTop + clientHeight) > 100);
    };

    const chatContainer = chatWindowRef.current?.querySelector('.messages-container');
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { 
      role: 'user', 
      content: input, 
      timestamp: new Date().toLocaleTimeString(),
      avatar: '👤'
    };
    const tempBotMessage = { 
      role: 'bot', 
      content: '', 
      isLoading: true, 
      timestamp: new Date().toLocaleTimeString(),
      avatar: '🤖'
    };
    
    setMessages(prev => [...prev, userMessage, tempBotMessage]);
    setInput('');

    try {
      const response = await fetch('http://localhost:5000/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex].isLoading) {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: data.response,
            displayIndex: 0,
            isLoading: false
          };
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex].isLoading) {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: error.message,
            displayIndex: 0,
            isLoading: false
          };
        }
        return newMessages;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      ref={chatWindowRef}
      className="fixed bottom-20 right-10 bg-black/80 backdrop-blur-lg border border-pink-500 rounded-lg shadow-lg flex flex-col"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        cursor: isResizing ? 'nwse-resize' : 'default'
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
    >
      <motion.div
        className="flex justify-between items-center p-4 border-b border-pink-500 cursor-move"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <h3 className="text-pink-400 font-squidFont">Chat with Us</h3>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }} 
          className="text-pink-400 hover:text-pink-300"
        >
          <i className="ri-close-line"></i>
        </button>
      </motion.div>

      <div className="messages-container flex-1 p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                {msg.avatar}
              </div>
              <div>
                <div
                  className={`inline-block p-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-pink-500 text-white'
                      : 'bg-pink-400/20 text-white'
                  }`}
                >
                  {msg.isLoading ? (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-pink-400 rounded-full" />
                      <div className="w-2 h-2 bg-pink-400 rounded-full" />
                      <div className="w-2 h-2 bg-pink-400 rounded-full" />
                    </motion.div>
                  ) : (
                    msg.role === 'bot' ? msg.content.slice(0, msg.displayIndex) : msg.content
                  )}
                </div>
                <div className="text-xs text-pink-400/50 mt-1">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-16 right-4 p-2 bg-pink-500 rounded-full text-white hover:bg-pink-600"
        >
          <i className="ri-arrow-down-s-line"></i>
        </button>
      )}

      <div className="p-4 border-t border-pink-500">
        <textarea
          placeholder="Type a message..."
          className="w-full p-2 bg-black/50 border border-pink-500 rounded-lg text-white resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
        />
      </div>

      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={startResizing}
      >
        <div className="w-full h-full border-r-2 border-b-2 border-pink-500" />
      </div>
    </motion.div>
  );
};

export default ChatWindow;