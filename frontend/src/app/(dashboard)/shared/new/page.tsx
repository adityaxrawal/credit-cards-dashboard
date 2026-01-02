'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/primitives/card';
import { Button } from '@/shared/components/ui/primitives/Button';
import { Input } from '@/shared/components/ui/primitives/Input';
import { Badge } from '@/shared/components/ui/primitives/Badge';
import apiClient from '@/lib/api-client';
import { CreateSharedExpensePayload } from '@/types/shared-expenses';
import { toastService } from '@/shared/utils/toast';

interface Participant {
  name: string;
  amount: string;
  isPayer: boolean;
}

export default function CreateSharedExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [description, setDescription] = useState('');
  const [groupName, setGroupName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [participants, setParticipants] = useState<Participant[]>([
    { name: 'You', amount: '', isPayer: true },
    { name: '', amount: '', isPayer: false }
  ]);

  const handleAddParticipant = () => {
    setParticipants([...participants, { name: '', amount: '', isPayer: false }]);
  };

  const handleRemoveParticipant = (index: number) => {
    const newParticipants = [...participants];
    newParticipants.splice(index, 1);
    setParticipants(newParticipants);
  };

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const newParticipants = [...participants];
    if (field === 'isPayer' && value === true) {
      // Uncheck others if single payer (simplification)
       newParticipants.forEach(p => p.isPayer = false);
    }
    // @ts-ignore
    newParticipants[index][field] = value;
    setParticipants(newParticipants);
  };

  const distributeEqually = () => {
    if (!totalAmount) return;
    const amount = parseFloat(totalAmount);
    if (isNaN(amount)) return;
    
    const splitAmount = (amount / participants.length).toFixed(2);
    const newParticipants = participants.map((p, idx) => ({
      ...p,
      amount: idx === participants.length - 1 
        ? (amount - (parseFloat(splitAmount) * (participants.length - 1))).toFixed(2) // Handle remainder
        : splitAmount
    }));
    setParticipants(newParticipants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !totalAmount || !groupName) {
      toastService.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload: CreateSharedExpensePayload = {
        description,
        total_amount: parseFloat(totalAmount),
        group_name: groupName,
        expense_date: date,
        splits: participants.map(p => ({
          participant_name: p.name,
          share_amount: parseFloat(p.amount) || 0,
          is_paid_by: p.isPayer
        }))
      };

      await apiClient.post('/shared-expenses', payload);
      toastService.success('Expense created successfully');
      router.push('/shared');
    } catch (error) {
      console.error('Failed to create expense:', error);
      toastService.error('Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 container mx-auto p-6 max-w-3xl animate-in slide-in-from-right-4 duration-500">
      <Button 
        variant="ghost" 
        onClick={() => router.back()}
        className="mb-4 pl-0 hover:bg-transparent hover:text-primary-green"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to List
      </Button>

      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-primary-text">Add Shared Expense</h1>
           <p className="text-muted-text mt-1">Record a new group expense to split</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="card-shadow bg-card-bg border-input">
          <CardHeader>
             <CardTitle>Expense Details</CardTitle>
             <CardDescription>Enter the total amount and who is involved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-primary-text">Description</label>
                    <Input 
                        placeholder="e.g. Dinner at Taj" 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                        className="input-base"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-primary-text">Group/Event Name</label>
                    <Input 
                        placeholder="e.g. Goa Trip" 
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)}
                         className="input-base"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-primary-text">Total Amount (INR)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-text">₹</span>
                        <Input 
                            type="number"
                            placeholder="0.00" 
                            className="pl-8 input-base"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-primary-text">Date</label>
                    <Input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        className="input-base"
                    />
                </div>
            </div>

            <div className="border-t border-input pt-6">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-primary-text">Split Details</h3>
                    <Button type="button" variant="outline" size="sm" onClick={distributeEqually} className="text-xs">
                        Distribute Equally
                    </Button>
                 </div>

                 <div className="space-y-3">
                    {participants.map((participant, index) => (
                        <div key={index} className="flex gap-3 items-end p-3 bg-primary-bg/50 rounded-lg group">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-muted-text">Name</label>
                                <Input 
                                    value={participant.name}
                                    onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                                    placeholder="Name"
                                    className="h-8 text-sm"
                                    disabled={index === 0} // Assuming user is always first
                                />
                            </div>
                            <div className="w-32 space-y-1">
                                <label className="text-xs text-muted-text">Share</label>
                                <Input 
                                    type="number"
                                    value={participant.amount}
                                    onChange={(e) => updateParticipant(index, 'amount', e.target.value)}
                                    placeholder="0.00"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="flex items-center h-10 pb-1 px-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        checked={participant.isPayer}
                                        onChange={() => updateParticipant(index, 'isPayer', true)}
                                        className="accent-primary-green w-4 h-4"
                                    />
                                    <span className="text-xs text-muted-text">Paid</span>
                                </label>
                            </div>
                            {index > 1 && (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRemoveParticipant(index)}
                                    className="text-destructive hover:text-destructive/80"
                                >
                                    <Trash className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                 </div>
                 
                 <Button 
                    type="button" 
                    variant="outline" 
                    className="mt-4 w-full border-dashed"
                    onClick={handleAddParticipant}
                 >
                    <Plus className="mr-2 h-4 w-4" /> Add Person
                 </Button>
            </div>

            <div className="flex justify-end pt-4">
                <Button type="submit" className="btn-primary min-w-[150px]" disabled={loading}>
                    {loading ? 'Saving...' : (
                        <>
                            <Save className="mr-2 h-4 w-4" /> Save Expense
                        </>
                    )}
                </Button>
            </div>

          </CardContent>
        </Card>
      </form>
    </div>
  );
}
