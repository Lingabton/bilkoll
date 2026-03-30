export default function Assumptions({ detail }) {
  const a = detail.assumptions
  return (
    <div className="bg-stone-100 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Antaganden</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-600">
        <div>
          <div className="text-stone-400">Körsträcka</div>
          <div className="font-medium">{a.mileage_per_year.toLocaleString('sv-SE')} mil/år</div>
        </div>
        <div>
          <div className="text-stone-400">Ägartid</div>
          <div className="font-medium">{a.ownership_years} år</div>
        </div>
        <div>
          <div className="text-stone-400">Bensinpris</div>
          <div className="font-medium">{a.fuel_price_kr_per_liter} kr/l</div>
        </div>
        <div>
          <div className="text-stone-400">Elpris</div>
          <div className="font-medium">{a.electricity_price_kr_per_kwh} kr/kWh</div>
        </div>
      </div>
      {detail.confidence === "low" && (
        <p className="text-[10px] text-amber-600 mt-3">
          ⚠ Begränsat datamaterial — priserna baseras på få annonser. Verklig kostnad kan avvika.
        </p>
      )}
    </div>
  )
}
