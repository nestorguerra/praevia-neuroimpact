const tabs = ["Resumen", "Timeline", "Modalidades", "Comparativa", "Recomendaciones", "Informe"];

export function Tabs() {
  return (
    <div className="tabs" role="tablist" aria-label="Vistas de resultados">
      {tabs.map((tab, index) => (
        <button key={tab} className={index === 0 ? "tab active" : "tab"} role="tab" aria-selected={index === 0}>
          {tab}
        </button>
      ))}
    </div>
  );
}

