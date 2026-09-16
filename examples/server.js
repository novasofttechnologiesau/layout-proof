import http from 'node:http';
import { pathToFileURL } from 'node:url';
export function fixture(kind = 'clean') {
  const body = kind === 'broken' ? '<div id="wide" style="width:1200px">A deliberately oversized panel.</div><button id="tiny" style="width:18px;height:18px;padding:0">+</button><div style="width:80px;overflow:hidden"><button id="clipped" style="width:160px">Clipped control</button></div>' : '<p>This page adapts to the available width.</p><button>Continue</button><div id="demo-scroll" tabindex="0" role="region" aria-label="Scrollable example" style="overflow:auto;max-width:100%"><div style="width:1800px">An intentional horizontal scroll region.</div></div>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Layout Proof ${kind} fixture</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{font:18px/1.6 system-ui;margin:24px}main{max-width:900px;margin:auto}button{font:inherit;min-height:44px;padding:8px 16px}#tiny{min-height:0}h1{font-size:28px}</style></head><body><main><h1>${kind === 'broken' ? 'Deliberately broken layout' : 'Responsive layout'}</h1>${body}</main></body></html>`;
}
export function createDemoServer() {
  return http.createServer((req, res) => {
    if (req.url === '/missing') { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixture(req.url.startsWith('/broken') ? 'broken' : 'clean'));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createDemoServer();
  server.listen(4173, '127.0.0.1', () => console.log('Synthetic demo: http://127.0.0.1:4173/clean and /broken'));
}
