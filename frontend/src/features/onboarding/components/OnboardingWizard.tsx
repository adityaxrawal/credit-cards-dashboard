
"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/shared/components/ui";
import { ArrowRight, Check, CreditCard, PieChart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { transactionApi } from "@/features/transactions/api";
// We'll need a way to update user metadata, assuming we have a userApi or similar
// For now, allow completion to just close the modal or call a dummy endpoint

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

export function OnboardingWizard({ isOpen, onClose, userName }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const router = useRouter();

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    // TODO: Call API to mark onboarding as complete
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="" size="lg">
       <div className="p-4">
         {/* Progress Bar */}
         <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((s) => (
               <div 
                 key={s} 
                 className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary-green' : 'bg-border'}`}
               />
            ))}
         </div>

         {/* Step Content */}
         <div className="min-h-[300px] flex flex-col justify-center items-center text-center space-y-6">
            
            {step === 1 && (
               <>
                 <div className="w-20 h-20 bg-primary-green/10 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl">👋</span>
                 </div>
                 <h2 className="text-2xl font-bold">Welcome to Antigravity Finance{userName ? `, ${userName}` : ''}!</h2>
                 <p className="text-secondary-text max-w-md">
                    Your new command center for financial clarity. Detect patterns, track expenses, and optimize your wealth automatically.
                 </p>
               </>
            )}

            {step === 2 && (
               <>
                 <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-500">
                    <CreditCard className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-bold">Connect Your Data</h2>
                 <p className="text-secondary-text max-w-md">
                    We've started scanning your emails for transaction data. You can also manually add cards or upload statements.
                 </p>
                 <div className="bg-hover-bg p-4 rounded-lg w-full max-w-sm text-left border border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                            <div className="font-semibold">Gmail Connected</div>
                            <div className="text-xs text-secondary-text">Scanning for potential transactions...</div>
                        </div>
                    </div>
                 </div>
               </>
            )}

            {step === 3 && (
               <>
                 <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 text-purple-500">
                    <PieChart className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-bold">Set Your Goals</h2>
                 <p className="text-secondary-text max-w-md">
                    Establish a monthly budget to keep your spending on track. You can adjust this anytime in Settings.
                 </p>
                 {/* Placeholder for budget input */}
               </>
            )}

         </div>

         {/* Footer Actions */}
         <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
             <Button 
                variant="ghost" 
                onClick={onClose}
                className="text-secondary-text hover:text-primary-text"
             >
                Skip Setup
             </Button>

             <Button size="lg" onClick={handleNext} className="gap-2">
                {step === totalSteps ? 'Get Started' : 'Next Step'}
                <ArrowRight className="w-4 h-4" />
             </Button>
         </div>
       </div>
    </Modal>
  );
}
