'use client';

const STEPS = ['AI分析', '我的决策', '实施改进', '验证成效'];

export default function StepIndicator({
  currentStep,
  onChange,
}: {
  currentStep: number;
  onChange: (step: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {STEPS.map((step, index) => {
        const active = currentStep === index;
        const done = currentStep > index;
        return (
          <button
            key={step}
            onClick={() => onChange(index)}
            className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
              active
                ? 'border-primary bg-primary/15 text-primary'
                : done
                  ? 'border-secondary/50 bg-secondary/10 text-secondary'
                  : 'border-dark-border bg-dark-bg text-gray-400'
            }`}
          >
            <div className="font-bold">{index + 1}</div>
            <div className="mt-1 whitespace-nowrap">{step}</div>
          </button>
        );
      })}
    </div>
  );
}

