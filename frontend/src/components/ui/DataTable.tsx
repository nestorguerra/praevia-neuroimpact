import { Badge } from "./Badge";

const rows = [
  ["Banco Atlas", "Hipotecas Q2", "A/B/C", "NRI 0.78", "Listo"],
  ["Retail Norte", "Spot apertura", "Individual", "NRI 0.64", "Revisar"],
  ["Evento Madrid", "Video manifiesto", "A/B", "NRI 0.71", "PDF"],
];

export function DataTable() {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Proyecto</th>
            <th>Tipo</th>
            <th>Score</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row[0]}-${row[1]}`}>
              {row.slice(0, 4).map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
              <td>
                <Badge tone={row[4] === "Revisar" ? "coral" : "lime"}>{row[4]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

