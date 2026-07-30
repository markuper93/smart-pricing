import { useState, useRef, useEffect } from 'react';
import api from '../api/client';
import { Send, Bot, User, Sparkles } from 'lucide-react';

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEnd = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/chat/message', {
        message: userMsg.content,
        history: messages.slice(-10),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאה בשליחת הודעה');
    }
    setLoading(false);
  };

  const suggestedQuestions = [
    'כמה אחוזים ירד הערך של דגם 481 מתחילת השנה?',
    'מה המחירון הממוצע של יונדאי?',
    'איזה דגם עלה הכי הרבה באחוזים?',
    'השווה בין ינואר ליולי 2026',
  ];

  return (
    <div className="animate-fade flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-amber-400" /> אינטגרציות חכמות</h1>
        <p className="text-dark-400 mt-1">שאלו שאלות על נתוני המחירונים</p>
      </div>

      <div className="flex-1 glass p-4 overflow-y-auto mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-16 h-16 text-dark-600 mb-4" />
            <p className="text-dark-400 mb-6">שאלו כל שאלה על נתוני מחירוני הרכב</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
              {suggestedQuestions.map((q, i) => (
                <button key={i} onClick={() => setInput(q)}
                  className="text-right p-3 bg-dark-800/50 border border-dark-700 rounded-lg text-sm text-dark-300 hover:border-primary-500/30 hover:text-white transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-white" /></div>}
            <div className={`max-w-[70%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-dark-800 text-dark-100 rounded-bl-sm'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-dark-300" /></div>}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
            <div className="bg-dark-800 p-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}></div>
                <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}

      <form onSubmit={sendMessage} className="glass p-3 flex gap-3">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="שאלו שאלה..."
          className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500" />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
