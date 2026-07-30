"use client";

import { useState, ReactNode } from "react";
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  content: ReactNode;
  optional?: boolean;
}

interface Props {
  title: string;
  steps: WizardStep[];
  onComplete: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export default function SetupWizard({ title, steps, onComplete, onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      await onComplete(data);
    } catch (err: any) {
      setError(err.message || "Setup failed");
    }
    setCompleting(false);
  };

  const updateData = (key: string, value: string) => {
    setData({ ...data, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i < currentStep
                      ? "bg-green-600 text-white"
                      : i === currentStep
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      i < currentStep ? "bg-green-600" : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}: {step.title}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-white font-medium mb-2">{step.title}</h3>
          <p className="text-sm text-gray-400 mb-4">{step.description}</p>
          <div className="space-y-4">
            {step.content}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 p-4 border-t border-gray-700">
          <button
            onClick={isFirst ? onClose : handleBack}
            className="flex items-center gap-1 px-4 py-2 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {isFirst ? "Cancel" : "Back"}
          </button>
          {isLast ? (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {completing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {completing ? "Setting up..." : "Complete Setup"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
