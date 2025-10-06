export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { service_key } = req.query;
  const map = {
    cvv_188:    { type: "call", label: "Ligar para CVV", value: "188" },
    samu_192:   { type: "call", label: "Ligar para SAMU", value: "192" },
    policia_190:{ type: "call", label: "Ligar para Polícia", value: "190" },
    sus_136:    { type: "call", label: "Ligar para Disque Saúde", value: "136" }
  };
  const found = map[service_key];
  if (!found) return res.status(404).json({ error: "service_key não encontrado" });
  return res.json(found);
}
