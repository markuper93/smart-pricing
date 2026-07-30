import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [newPass, setNewPass] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState(1);

  const handleRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      if (res.data.dev_token) setDevToken(res.data.dev_token);
      setStep(2);
    } catch (err) { setMessage('שגיאה'); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/reset-password', { token: devToken || token, new_password: newPass });
      setMessage('סיסמה אופסה בהצלחה! ניתן להתחבר כעת.');
      setStep(3);
    } catch (err) { setMessage(err.response?.data?.detail || 'שגיאה'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="glass p-10 w-full max-w-md animate-fade relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">איפוס סיסמה</h2>
        </div>
        {step === 1 && (
          <form onSubmit={handleRequest} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">{'דוא"ל'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" required />
            </div>
            <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-600/20">
              שלח קישור איפוס
            </button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleReset} className="space-y-5">
            {devToken && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-amber-400 text-sm text-center">טוקן לפיתוח: {devToken}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">טוקן איפוס</label>
              <input type="text" value={token} onChange={e => setToken(e.target.value)}
                className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">סיסמה חדשה</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" required />
            </div>
            <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-600/20">
              אפס סיסמה
            </button>
          </form>
        )}
        {step === 3 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-emerald-400 text-center">{message}</p>
          </div>
        )}
        {message && step < 3 && <p className="text-dark-300 text-sm text-center mt-3">{message}</p>}
        <div className="mt-6 text-center"><Link to="/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">חזרה להתחברות</Link></div>
      </div>
    </div>
  );
}
