"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/shared/utils";
import { Plus, Home, Car, Gem, Trash2, Loader2 } from "lucide-react";
import { Button, Input, Modal, Card } from "@/shared/components/ui";
import { accountsApi, Account, AccountInput } from "@/features/accounts/api";

// Asset types that map to account types
const ASSET_TYPES = ['real_estate', 'vehicle', 'jewelry', 'physical_asset', 'other_asset'] as const;
type AssetType = typeof ASSET_TYPES[number];

interface AssetFormData {
    name: string;
    type: AssetType;
    value: number;
    description?: string;
}

export default function AssetsPageClient() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<AssetFormData>>({ type: 'other_asset' });

    // Fetch accounts that are physical assets
    const { data: accounts = [], isLoading, error } = useQuery({
        queryKey: ['accounts-assets'],
        queryFn: async () => {
            // Fetch all accounts and filter for asset types
            const allAccounts = await accountsApi.getAll();
            return allAccounts.filter(account => 
                ASSET_TYPES.includes(account.type as AssetType) ||
                account.type === 'asset' ||
                account.type === 'property' ||
                account.type === 'real_estate' ||
                account.type === 'vehicle'
            );
        },
    });

    // Create asset mutation
    const createMutation = useMutation({
        mutationFn: (input: AccountInput) => accountsApi.create(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts-assets'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts-summary'] });
            setIsModalOpen(false);
            setFormData({ type: 'other_asset' });
        },
    });

    // Delete asset mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => accountsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts-assets'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts-summary'] });
        },
    });

    const totalValue = accounts.reduce((sum, a) => sum + a.balance, 0);

    const getIcon = (type: string) => {
        switch(type) {
            case 'real_estate':
            case 'property': 
                return <Home className="w-5 h-5 text-indigo-500" />;
            case 'vehicle': 
                return <Car className="w-5 h-5 text-blue-500" />;
            case 'jewelry': 
                return <Gem className="w-5 h-5 text-pink-500" />;
            default: 
                return <Gem className="w-5 h-5 text-gray-500" />;
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        
        const input: AccountInput = {
            type: formData.type || 'other_asset',
            name: formData.name || "New Asset",
            balance: Number(formData.value) || 0,
            currency: 'INR',
            metadata: formData.description ? { description: formData.description } : undefined,
        };

        createMutation.mutate(input);
    };

    const handleDelete = (id: string) => {
        if(confirm("Delete this asset?")) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-green" />
                <span className="ml-3 text-secondary-text">Loading assets...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-error mb-2">Failed to load assets</p>
                <p className="text-secondary-text text-sm">Please try refreshing the page</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                   <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                       Physical Assets
                   </h2>
                   <p className="text-sm text-secondary-text">Track value of real estate, vehicles, and valuables.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-secondary-text uppercase tracking-wider">Total Value</p>
                    <p className="text-2xl font-mono font-bold text-primary-text">{formatCurrency(totalValue)}</p>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Asset
                </Button>
            </div>

            {accounts.length === 0 ? (
                <Card className="p-12 text-center bg-card-bg border-border">
                    <p className="text-secondary-text">No physical assets tracked yet.</p>
                    <p className="text-sm text-muted-text mt-1">Add real estate, vehicles, or valuables to track your net worth.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {accounts.map(asset => (
                        <Card key={asset.id} className="p-4 flex items-center justify-between hover:bg-hover-bg transition-colors border-border">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-bg rounded-xl border border-border">
                                    {getIcon(asset.type)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-primary-text">{asset.name}</h3>
                                    <p className="text-xs text-secondary-text">
                                        {(asset.metadata as any)?.description || asset.type.replace('_', ' ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="font-mono font-medium text-lg text-primary-text">
                                    {formatCurrency(asset.balance)}
                                </span>
                                <button 
                                    onClick={() => handleDelete(asset.id)}
                                    disabled={deleteMutation.isPending}
                                    className="p-2 text-muted-text hover:text-error transition-colors disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Asset">
                <form onSubmit={handleAdd} className="space-y-4">
                    <Input 
                        label="Asset Name" 
                        required 
                        value={formData.name || ''} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                    <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <select 
                            className="w-full p-2 rounded border border-input bg-card-bg"
                            value={formData.type}
                            onChange={(e) => setFormData({...formData, type: e.target.value as AssetType})}
                        >
                            <option value="real_estate">Real Estate</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="jewelry">Jewelry / Art</option>
                            <option value="other_asset">Other</option>
                        </select>
                    </div>
                    <Input 
                        label="Estimated Value" 
                        type="number" 
                        required 
                        value={formData.value || ''} 
                        onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                    />
                    <Input 
                        label="Description (Optional)" 
                        value={formData.description || ''} 
                        onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Adding...' : 'Add Asset'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
