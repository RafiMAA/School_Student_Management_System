import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiClient';
import { User, Phone, Save, AtSign, MapPin, BookOpen } from 'lucide-react';

export default function Profile() {
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name: '',
    email: '',
    contact: '',
    address: ''
  });
  const [assignedClass, setAssignedClass] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest profile details
    api.get<any>('/auth/me').then(data => {
      setFormData(prev => ({
        ...prev,
        full_name: data.full_name || '',
        email: data.email || '',
        contact: data.contact || '',
        address: data.address || ''
      }));
      setAssignedClass(data.assigned_class || null);
    }).catch(() => {
      addToast('error', 'Failed to load profile');
    });
  }, [addToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Only send password if it's not empty
    const payload: any = {
      full_name: formData.full_name,
      contact: formData.contact,
      address: formData.address,
    };
    
    try {
      const updatedUser = await api.put<any>('/auth/profile', payload);
      addToast('success', 'Profile updated successfully');
      
      // Update local storage so the next reload has fresh data instantly
      if (user) {
        const newLocalUser = { ...user, full_name: updatedUser.full_name, email: updatedUser.email };
        localStorage.setItem('ahadiya_user', JSON.stringify(newLocalUser));
      }
      
      // Reload to reflect name changes in the header
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage your account settings and credentials</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Contact Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  required
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSign className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-sm outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter your address"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {user?.role !== 'Principal' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Assigned Class</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={assignedClass || 'No Class Assigned'}
                    readOnly
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !formData.full_name || !formData.contact}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
