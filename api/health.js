export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.json({ ok: true });
}
