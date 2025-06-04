// app/page.tsx
'use client';

import { useState, FormEvent, useRef, useEffect, type JSX } from 'react';
import { Send, Bot, User, Sparkles, MessageCircle, Loader2, Zap, BrainCircuit } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ModelProvider = 'deepseek_hf' | 'groq_llama';

interface ModelInfo {
  id: ModelProvider;
  name: string;
  apiEndpoint: string;
  description: string;
  icon: JSX.Element;
  defaultPromptPlaceholder: string;
  modelNameDisplay: string;
}

const MODELS_AVAILABLE: ModelInfo[] = [
  {
    id: 'deepseek_hf',
    name: 'DeepSeek (HF/Novita)',
    apiEndpoint: '/api/huggingface', // تأكد من أن هذا المسار صحيح
    description: 'مدعوم بواسطة Novita & HuggingFace',
    icon: <Sparkles className="w-5 h-5 text-purple-500" />,
    defaultPromptPlaceholder: 'اكتب رسالتك لـ DeepSeek...',
    modelNameDisplay: 'DeepSeek-V3',
  },
  {
    id: 'groq_llama',
    name: 'LLaMA 3 (Groq)',
    apiEndpoint: '/api/groq',
    description: 'مدعوم بواسطة Groq API لسرعة فائقة',
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    defaultPromptPlaceholder: 'اكتب رسالتك لـ LLaMA 3...',
    modelNameDisplay: 'LLaMA3 (Groq)',
  },
];

export default function ChatPage() {
  const [activeModelId, setActiveModelId] = useState<ModelProvider>(MODELS_AVAILABLE[0].id);
  const [prompt, setPrompt] = useState<string>('');
  // Separate chat history for each model
  const [chatHistories, setChatHistories] = useState<Record<ModelProvider, ChatMessage[]>>({
    deepseek_hf: [],
    groq_llama: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModel = MODELS_AVAILABLE.find(m => m.id === activeModelId) || MODELS_AVAILABLE[0];
  const currentChatHistory = chatHistories[activeModelId];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistories, activeModelId, isLoading]);
  
  useEffect(() => {
     // Reset prompt and error when switching models
     setPrompt('');
     setError(null);
     if (textareaRef.current) {
       textareaRef.current.placeholder = currentModel.defaultPromptPlaceholder;
       textareaRef.current.style.height = 'auto';
     }
  }, [activeModelId, currentModel.defaultPromptPlaceholder]);


  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };
  
  useEffect(adjustTextareaHeight, [prompt]);


  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!prompt.trim() && currentChatHistory.length === 0) return;

    setIsLoading(true);
    setError(null);

    const currentPromptContent = prompt;
    const newUserMessage: ChatMessage = { role: 'user', content: currentPromptContent };
    
    // History to be sent to API (without the current new user message)
    const historyForAPI = [...currentChatHistory]; 

    // Update UI optimistically
    const updatedHistoryForUI = currentPromptContent.trim() ? [...currentChatHistory, newUserMessage] : [...currentChatHistory];
    setChatHistories(prev => ({ ...prev, [activeModelId]: updatedHistoryForUI }));
    
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch(currentModel.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: currentPromptContent, // Send the new prompt
          history: historyForAPI,    // Send the history *before* this new prompt
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error from server" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.reply && data.reply.content) {
        setChatHistories(prev => ({
          ...prev,
          [activeModelId]: [...updatedHistoryForUI.filter(m => m !== newUserMessage || currentPromptContent.trim()), data.reply as ChatMessage]
        }));
      } else {
        throw new Error('No valid reply content found in the server response.');
      }

    } catch (err: any) {
      console.error(`Error submitting prompt to ${currentModel.name}:`, err);
      setError(err.message || 'An unexpected error occurred.');
      // Revert optimistic update on error
      setChatHistories(prev => ({ ...prev, [activeModelId]: historyForAPI }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Chat Interface
              </h1>
              <p className="text-sm text-gray-600">
                {currentModel.description}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {currentModel.icon}
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {currentModel.modelNameDisplay}
              </span>
            </div>
          </div>
          {/* Tabs */}
          <div className="mt-4 flex border-b border-gray-200">
            {MODELS_AVAILABLE.map((model) => (
              <button
                key={model.id}
                onClick={() => setActiveModelId(model.id)}
                className={`px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-150
                  ${activeModelId === model.id
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col flex-grow h-[calc(100vh-160px)]"> {/* Adjusted height */}
        
        <div className="flex-1 overflow-hidden rounded-2xl bg-white/60 backdrop-blur-lg border border-white/20 shadow-xl flex flex-col">
          <div className="h-full overflow-y-auto p-6 space-y-4 flex-grow" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            
            {currentChatHistory.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  مرحباً بك في {currentModel.name}
                </h3>
                <p className="text-gray-500 max-w-md">
                  ابدأ محادثة جديدة. اطرح أي سؤال أو اطلب المساعدة!
                </p>
              </div>
            )}

            {currentChatHistory.map((msg, index) => (
              <div
                key={`${activeModelId}-${index}`} // Ensure unique key on model switch
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-lg ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white ml-auto'
                      : 'bg-white/80 backdrop-blur-sm border border-white/20 text-gray-800'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start animate-fadeIn">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{currentModel.name} يفكر...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="mt-4 pb-4"> {/* Added pb-4 for some spacing */}
          <form onSubmit={handleSubmit} className="relative">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={currentModel.defaultPromptPlaceholder}
                className="w-full px-6 py-4 bg-transparent border-none outline-none resize-none text-gray-800 placeholder-gray-500 min-h-[60px] max-h-32"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              />
              
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50/50 border-t border-gray-200/50">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  متصل بـ {currentModel.name}
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isLoading ? 'جاري الإرسال...' : 'إرسال'}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-3 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm animate-fadeIn">
              <strong>خطأ:</strong> {error}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        /* For Webkit browsers like Chrome, Safari */
       .h-full.overflow-y-auto::-webkit-scrollbar {
         width: 8px; /* Width of the scrollbar */
       }
       .h-full.overflow-y-auto::-webkit-scrollbar-track {
         background: transparent; /* Color of the track */
       }
       .h-full.overflow-y-auto::-webkit-scrollbar-thumb {
         background-color: #cbd5e1; /* Color of the scroll thumb */
         border-radius: 10px; /* Roundness of the scroll thumb */
         border: 2px solid transparent; /* Creates padding around scroll thumb */
         background-clip: content-box;
       }
       .h-full.overflow-y-auto::-webkit-scrollbar-thumb:hover {
         background-color: #94a3b8; /* Color on hover */
       }
      `}</style>
    </div>
  );
}