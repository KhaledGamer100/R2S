// Settings Modal - Allows users to configure Google Apps Script URL or Firebase config
// Automatically saves to localStorage

import { useState } from 'react';
import { getGasUrl, saveGasUrl } from '../utils/sessionManager';
import { getCustomFirebaseConfig, saveCustomFirebaseConfig } from '../config/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [gasUrl, setGasUrl] = useState(getGasUrl());
  
  const customFb = getCustomFirebaseConfig() || { apiKey: '', databaseURL: '', projectId: '' };
  const [fbApiKey, setFbApiKey] = useState(customFb.apiKey || '');
  const [fbDbUrl, setFbDbUrl] = useState(customFb.databaseURL || '');
  const [fbProjectId, setFbProjectId] = useState(customFb.projectId || '');
  const [savedMessage, setSavedMessage] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    saveGasUrl(gasUrl.trim());
    if (fbApiKey.trim() && fbDbUrl.trim()) {
      saveCustomFirebaseConfig({
        apiKey: fbApiKey.trim(),
        databaseURL: fbDbUrl.trim(),
        projectId: fbProjectId.trim() || 'collab-app'
      });
    } else {
      localStorage.removeItem('collab_custom_firebase');
    }
    setSavedMessage('تم حفظ الإعدادات بنجاح! ✓');
    setTimeout(() => {
      setSavedMessage('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 fade-in">
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in-up border border-cyan-500/30">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              ⚙️
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">إعدادات الاتصال وقاعدة البيانات</h2>
              <p className="text-white/40 text-xs">اربط التطبيق بشيت جوجل أو Firebase</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg">✕</button>
        </div>

        {/* Info box */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3.5 mb-6 text-xs text-cyan-300 leading-relaxed">
          💡 <strong>معلومة مهمة:</strong> التطبيق بيشتغل حالياً عبر <strong>PeerJS P2P (اتصال مباشر بين الأجهزة)</strong> ومتقلقش كله شغال مجاني وسريع جداً. لو عايز تحفظ أرشيف الحلول في شيت جوجل، حط رابط الـ Google Apps Script تحت.
        </div>

        <div className="space-y-5">
          {/* Google Apps Script URL */}
          <div>
            <label className="block text-white/80 text-xs font-bold mb-1.5">
              📊 رابط Google Apps Script (للحفظ في Google Sheets)
            </label>
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/xxx/exec"
              className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white text-xs placeholder-white/20 font-mono text-left direction-ltr"
              dir="ltr"
            />
            <p className="text-white/30 text-[11px] mt-1">لما تدوس &quot;يلا على اللي بعده&quot; هيتبعت ملخص الحلول للشيت تلقائياً.</p>
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-sm">🔥</span>
              <h3 className="text-white/90 text-xs font-bold">إعدادات Firebase Realtime DB (اختياري)</h3>
            </div>
            <p className="text-white/40 text-[11px] mb-3">لو حابب تستخدم Firebase بدل الاتصال المباشر P2P بين المتصفحات:</p>

            <div className="space-y-3">
              <div>
                <label className="block text-white/60 text-[11px] mb-1">API Key</label>
                <input
                  type="text"
                  value={fbApiKey}
                  onChange={(e) => setFbApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="glass-input w-full px-3 py-2 rounded-lg text-white text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-white/60 text-[11px] mb-1">Database URL</label>
                <input
                  type="url"
                  value={fbDbUrl}
                  onChange={(e) => setFbDbUrl(e.target.value)}
                  placeholder="https://your-project-default-rtdb.firebaseio.com"
                  className="glass-input w-full px-3 py-2 rounded-lg text-white text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-white/60 text-[11px] mb-1">Project ID (مثلاً: collab-app)</label>
                <input
                  type="text"
                  value={fbProjectId}
                  onChange={(e) => setFbProjectId(e.target.value)}
                  placeholder="collab-app"
                  className="glass-input w-full px-3 py-2 rounded-lg text-white text-xs font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {savedMessage && (
          <div className="mt-5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-emerald-300 text-xs font-bold text-center animate-pulse">
            {savedMessage}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 glass px-4 py-2.5 rounded-xl text-white/50 hover:text-white text-xs font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-l from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            حفظ وتفعيل 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
