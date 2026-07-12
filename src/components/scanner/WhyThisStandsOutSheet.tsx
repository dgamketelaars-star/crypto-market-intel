import type { AttentionExplanation } from '../../analysis/engine/types';
import { Sheet } from '../ui/Sheet';

interface WhyThisStandsOutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  explanation: AttentionExplanation;
}

function FeatureList({ title, items, dotClassName }: { title: string; items: AttentionExplanation['supporting']; dotClassName: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex gap-2 text-sm text-slate-300">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dotClassName}`} />
            <span>
              <span className="font-medium text-slate-200">{item.label}.</span> {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhyThisStandsOutSheet({ isOpen, onClose, symbol, explanation }: WhyThisStandsOutSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} eyebrow="Waarom valt dit op?" title={symbol.replace(/USDT$/, '')}>
      <p className="text-slate-200">{explanation.headline}</p>
      <div className="space-y-4 pt-2">
        <FeatureList title="Ondersteunende signalen" items={explanation.supporting} dotClassName="bg-sky-400" />
        <FeatureList title="Tegenstrijdige signalen" items={explanation.conflicting} dotClassName="bg-amber-400" />
        <FeatureList title="Neutraal" items={explanation.neutral} dotClassName="bg-slate-500" />
        <FeatureList title="Ontbrekende data" items={explanation.missingData} dotClassName="bg-slate-600" />
      </div>
      <p className="pt-2 text-xs text-slate-500">
        Dit is een gecalculeerde observatie op basis van objectieve marktkenmerken — geen trading-signaal en geen
        koersrichting.
      </p>
    </Sheet>
  );
}
