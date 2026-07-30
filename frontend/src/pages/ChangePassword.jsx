import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Lock } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

export default function ChangePassword() {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass !== confirmPass) { setError('הסיסמאות אינן תואמות'); return; }
    if (newPass.length < 8) { setError('סיסמה חייבת להכיל לפחות 8 תווים'); return; }
    try {
      await api.post('/auth/change-password', { old_password: oldPass, new_password: newPass });
      setSuccess('סיסמה שונתה בהצלחה!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאה');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="glass p-10 w-full max-w-md animate-fade relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">שינוי סיסמה</h2>
          <p className="text-dark-400 text-sm mt-2">נדרש לשנות סיסמה בהתחברות הראשונה</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">סיסמה נוכחית</label>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
              className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">סיסמה חדשה</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">אימות סיסמה חדשה</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all" required />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-emerald-400 text-sm text-center">{success}</p>
            </div>
          )}
          <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-600/20">
            שנה סיסמה
          </button>
        </form>
      </div>
    </div>
  );
}
