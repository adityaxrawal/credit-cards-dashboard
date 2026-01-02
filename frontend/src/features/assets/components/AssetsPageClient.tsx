"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/shared/utils";
import { Plus, Home, Car, Gem, Trash2 } from "lucide-react";
import { Button, Input, Modal, Card } from "@/shared/components/ui";

interface ManualAsset {
    id: string;
    name: string;
    type: "real_estate" | "vehicle" | "jewelry" | "other";
    value: number;
    description?: string;
}

// Mock Data - In real app, this would be an API
const INITIAL_ASSETS: ManualAsset[] = [
    { id: "1", name: "Primary Residence", type: "real_estate", value: 450000, description: "Apartment in Downtown" },
    { id: "2", name: "Tesla Model 3", type: "vehicle", value: 35000 },
];

export default function AssetsPageClient() {
    const [assets, setAssets] = useState<ManualAsset[]>(INITIAL_ASSETS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ManualAsset>>({ type: 'other' });

    const totalValue = assets.reduce((sum, a) => sum + a.value, 0);

    const getIcon = (type: string) => {
        switch(type) {
            case 'real_estate': return <Home className="w-5 h-5 text-indigo-500" />;
            case 'vehicle': return <Car className="w-5 h-5 text-blue-500" />;
            case 'jewelry': return <Gem className="w-5 h-5 text-pink-500" />;
            default: return <Gem className="w-5 h-5 text-gray-500" />;
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const newAsset: ManualAsset = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name || "New Asset",
            type: (formData.type as any) || "other",
            value: Number(formData.value) || 0,
            description: formData.description
        };
        setAssets([...assets, newAsset]);
        setIsModalOpen(false);
        setFormData({ type: 'other' });
    };

    const handleDelete = (id: string) => {
        if(confirm("Delete this asset?")) {
            setAssets(assets.filter(a => a.id !== id));
        }
    };

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

            <div className="grid grid-cols-1 gap-4">
                {assets.map(asset => (
                    <Card key={asset.id} className="p-4 flex items-center justify-between hover:bg-hover-bg transition-colors border-border">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary-bg rounded-xl border border-border">
                                {getIcon(asset.type)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-primary-text">{asset.name}</h3>
                                <p className="text-xs text-secondary-text">{asset.description || asset.type}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="font-mono font-medium text-lg text-primary-text">
                                {formatCurrency(asset.value)}
                            </span>
                            <button 
                                onClick={() => handleDelete(asset.id)}
                                className="p-2 text-muted-text hover:text-error transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

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
                            onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                        >
                            <option value="real_estate">Real Estate</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="jewelry">Jewelry / Art</option>
                            <option value="other">Other</option>
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
                        <Button type="submit">Add Asset</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
