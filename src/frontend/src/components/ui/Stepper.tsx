import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string | number;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number; // 1-indexed
  onStepClick?: (step: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;
            const isClickable = !!onStepClick && isCompleted;

            return (
              <li
                key={step.id}
                className={`relative flex-1 ${
                  index !== steps.length - 1 ? 'pr-4 sm:pr-8' : ''
                }`}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick(stepNumber)}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition border-2 ${
                      isCompleted
                        ? 'bg-electric-600 border-electric-600 text-white cursor-pointer hover:bg-electric-700'
                        : isCurrent
                        ? 'border-electric-600 bg-white text-electric-600 ring-4 ring-electric-100 cursor-default'
                        : 'border-surface-300 bg-white text-navy-400 cursor-default'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stepNumber}
                  </button>

                  {index !== steps.length - 1 && (
                    <div
                      className={`ml-2 sm:ml-4 flex-1 h-0.5 rounded ${
                        isCompleted ? 'bg-electric-600' : 'bg-surface-200'
                      }`}
                    />
                  )}
                </div>

                <div className="mt-2">
                  <span
                    className={`block text-xs font-bold leading-tight ${
                      isCurrent
                        ? 'text-electric-700'
                        : isCompleted
                        ? 'text-navy-900'
                        : 'text-navy-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="hidden sm:block text-[10px] text-navy-500 mt-0.5">
                      {step.description}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
};
