import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FileBarChart, Users, MessageSquare, TrendingUp, ArrowLeft, X, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ groups: 0, priceLists: 0 });
  const [priceLists, setPriceLists] = useState([]);
  const [showLists, setShowLists] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/user/groups').catch(() => ({ data: [] })),
      api.get('/user/price-lists').catch(() => ({ data: [] })),
    ]).then(([groups, lists]) => {
      setStats({ groups: groups.data.length, priceLists: lists.data.length });
      setPriceLists(lists.data);
    });
  }, []);

  return (
    <div className="animate-fade">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">שלום, {user?.username}!</h1>
        <p className="text-dark-400 mt-1">ברוכים הבאים למחירון חכם</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Groups card */}
        <button onClick={() => navigate('/groups')}
          className="glass p-6 text-right hover:border-primary-500/50 transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <ArrowLeft className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.groups}</p>
          <p className="text-sm text-dark-400 mt-1">קבוצות מעקב</p>
        </button>

        {/* Price lists card - shows list on click */}
        <button onClick={() => setShowLists(!showLists)}
          className="glass p-6 text-right hover:border-primary-500/50 transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <FileBarChart className="w-6 h-6 text-white" />
            </div>
            <Calendar className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.priceLists}</p>
          <p className="text-sm text-dark-400 mt-1">מחירונים במערכת</p>
        </button>

        {/* Reports card */}
        <button onClick={() => navigate('/reports')}
          className="glass p-6 text-right hover:border-primary-500/50 transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <ArrowLeft className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-white">השוואה</p>
          <p className="text-sm text-dark-400 mt-1">הפקת דוחות</p>
        </button>

        {/* AI Chat card */}
        <button onClick={() => navigate('/chat')}
          className="glass p-6 text-right hover:border-primary-500/50 transition-all group cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <ArrowLeft className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-white">שאלו</p>
          <p className="text-sm text-dark-400 mt-1">צ'אט AI</p>
        </button>
      </div>

      {/* Price lists panel - shown when clicking the price lists card */}
      {showLists && (
        <div className="glass p-5 mb-6 animate-fade">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileBarChart className="w-5 h-5" /> מחירונים מוזנים במערכת
            </h3>
            <button onClick={() => setShowLists(false)} className="text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {priceLists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {priceLists.map((pl, i) => (
                <div key={pl.id} className="glass-light p-3 rounded-lg text-center">
                  <span className="text-white font-medium">{pl.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-400 text-center py-4">אין מחירונים במערכת</p>
          )}
        </div>
      )}

      <div className="glass p-6">
        <h2 className="text-lg font-semibold text-white mb-4">פעולות מהירות</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => navigate('/groups')} className="glass-light p-4 text-right hover:border-primary-500/30 transition-all">
            <p className="font-medium text-white">יצירת קבוצה חדשה</p>
            <p className="text-sm text-dark-400 mt-1">בחר דגמי רכב ושנתונים למעקב</p>
          </button>
          <button onClick={() => navigate('/reports')} className="glass-light p-4 text-right hover:border-primary-500/30 transition-all">
            <p className="font-medium text-white">השוואת מחירונים</p>
            <p className="text-sm text-dark-400 mt-1">השווה בין חודשי מחירון</p>
          </button>
          <button onClick={() => navigate('/chat')} className="glass-light p-4 text-right hover:border-primary-500/30 transition-all">
            <p className="font-medium text-white">שאלו את ה-AI</p>
            <p className="text-sm text-dark-400 mt-1">ניתוח חכם של נתוני מחירונים</p>
          </button>
        </div>
      </div>
    </div>
  );
}
