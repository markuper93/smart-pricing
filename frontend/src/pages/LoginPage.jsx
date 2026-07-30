import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.requiresPasswordChange) {
        navigate('/change-password');
      } else if (result.success) {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאת התחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="glass p-10 w-full max-w-md animate-fade relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary-500/30">
            <img src={logoSvg} alt="לוגו" className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">מחירון חכם</h1>
          <p className="text-dark-400 mt-2 text-sm">השוואת מחירוני יצחק לוי</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">שם משתמש</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all"
              placeholder="הזן שם משתמש" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">סיסמה</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-dark-800/80 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all pl-12"
                placeholder="הזן סיסמה" required />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">שכחת סיסמה?</Link>
        </div>
      </div>
    </div>
  );
}
