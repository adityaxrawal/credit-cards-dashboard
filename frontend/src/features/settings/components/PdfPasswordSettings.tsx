
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Key, AlertCircle, Info, Lock } from 'lucide-react';
import { Button, Input, Label } from '@/shared/components/ui';
import { useToast } from '@/shared/utils/toast';
import { settingsApi, PdfPassword } from '../api';
import { cn } from '@/shared/utils';

export function PdfPasswordSettings() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();
  const [isAdding, setIsAdding] = React.useState(false);
  
  // Form State
  const [formData, setFormData] = React.useState({
    password_name: '',
    password_value: '',
    bank_hint: ''
  });

  // Fetch passwords
  const { data: passwords, isLoading } = useQuery({
    queryKey: ['pdf-passwords'],
    queryFn: settingsApi.listPdfPasswords
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: settingsApi.addPdfPassword,
    onSuccess: () => {
      success('Password added successfully');
      setFormData({ password_name: '', password_value: '', bank_hint: '' });
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['pdf-passwords'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Failed to add password';
      errorToast(msg);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: settingsApi.deletePdfPassword,
    onSuccess: () => {
      success('Password removed');
      queryClient.invalidateQueries({ queryKey: ['pdf-passwords'] });
    },
    onError: () => {
      errorToast('Failed to remove password');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password_name || !formData.password_value) return;
    addMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-hover-bg rounded w-3/4"></div>
          <div className="h-4 bg-hover-bg rounded w-1/2"></div>
          <div className="h-4 bg-hover-bg rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          PDF Passwords
        </h2>
        <p className="text-secondary-text">
          Manage passwords for encrypted bank statements. We'll try these first before attempting common default formats.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-primary-blue/5 border border-primary-blue/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary-blue shrink-0 mt-0.5" />
          <div className="text-sm text-secondary-text">
            <p className="font-medium text-primary-text mb-1">Automatic Format Detection</p>
            <p className="mb-2">
              Even without saving passwords here, we automatically try standard formats based on your profile:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li><strong>HDFC/Kotak/AMEX:</strong> Date of Birth (DDMMYYYY)</li>
              <li><strong>ICICI:</strong> First 4 letters of PAN + DOB (DDMMYY)</li>
              <li><strong>SBI:</strong> Customer ID (CIF)</li>
              <li><strong>Axis:</strong> Last 4 digits of registered mobile + DOB</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Password List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-primary-text">Saved Passwords</h3>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add New
            </Button>
          )}
        </div>

        {passwords && passwords.length > 0 ? (
          <div className="space-y-3">
            {passwords.map((pwd) => (
              <div 
                key={pwd.id}
                className="flex items-center justify-between p-3 bg-hover-bg rounded-lg border border-transparent hover:border-muted-text/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-green/10 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-primary-green" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-primary-text">{pwd.password_name}</h4>
                    <p className="text-xs text-secondary-text font-mono mt-0.5">
                      {pwd.password_masked} {pwd.bank_hint && `• ${pwd.bank_hint}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-secondary-text hover:text-red-400 hover:bg-red-400/10"
                  onClick={() => deleteMutation.mutate(pwd.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          !isAdding && (
            <div className="text-center py-8 text-secondary-text bg-hover-bg/30 rounded-lg border border-dashed border-muted-text/20">
              <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No passwords saved yet</p>
            </div>
          )
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-hover-bg p-4 rounded-lg border border-primary-green/20 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-medium text-primary-text mb-4">Add New Password</h3>
          <div className="space-y-4">
            <Input
              label="Friendly Name"
              placeholder="e.g. My HDFC Card"
              value={formData.password_name}
              onChange={e => setFormData({...formData, password_name: e.target.value})}
              required
            />
            
            <Input
              label="Password"
              type="text" // Show as text so user can verify before saving, or password if preferred
              placeholder="Enter PDF password"
              value={formData.password_value}
              onChange={e => setFormData({...formData, password_value: e.target.value})}
              required
              helperText="This will be encrypted securely."
            />

            <Input
              label="Bank Name (Optional)"
              placeholder="e.g. HDFC"
              value={formData.bank_hint}
              onChange={e => setFormData({...formData, bank_hint: e.target.value})}
            />

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Saving...' : 'Save Password'}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
