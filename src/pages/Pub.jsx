import { Beer, ShoppingCart } from 'lucide-react';
import BackButton from '../components/BackButton';

function Pub() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-32">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tight">הפאב</h1>
        <BackButton pageKey="pub" />
      </div>

      <div className="glass-card flex flex-col items-center justify-center min-h-[50vh] p-8 text-center mt-12 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-amber-100 p-8 rounded-[40px] mb-8 shadow-xl shadow-amber-500/20 group-hover:scale-110 transition-transform duration-500">
            <Beer size={80} className="text-amber-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-4 group-hover:text-amber-600 transition-colors">
            בקרוב...
          </h2>
          <p className="text-xl text-slate-500 font-medium max-w-md leading-relaxed">
            מערכת הזמנות לפאב בבנייה.
            <br />
            בינתיים נתראה על הבר!
          </p>
        </div>
      </div>
    </div>
  );
}

export default Pub;