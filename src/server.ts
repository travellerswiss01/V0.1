import {createServer} from "node:http";
import {randomUUID} from "node:crypto";
import {Memory} from "./core/memory.js";
import {runCeoCycle} from "./agents/ceo.js";
import {executeDecision} from "./agents/executor.js";
import {executeCodeAgent} from "./agents/code-agent.js";
import {askCeo} from "./agents/ai-ceo.js";
import {runCeoDecisionLoop} from "./agents/ceo-loop.js";

const port=Number(process.env.PORT||3000);
const memory=new Memory(Number(process.env.STARTING_CAPITAL_CHF||100),process.env.COMPANY_STATE_PATH||"data/company-state.json");

const escapeHtml=(value:unknown)=>{
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
};

const ledger=()=>memory.getLedger();

const pipeline=()=>{
  const s=memory.snapshot();
  const latest=s.executions.at(-1);
  const latestDecision=s.decisions.at(-1);
  const review=latest?.artifacts?.review;
  return {
    cycle:s.cycle,
    stage:latest?.status==="completed"?"reviewed":latest?.status==="failed"?"failed":latestDecision?.status==="pending_approval"?"approval":"decision",
    decision:latestDecision?.status??"none",
    execution:latest?.status??"none",
    review:review?.approved===true?"approved":review?"rejected":"none",
    reviewScore:review?.score??null,
    repairCount:latest?.output?.match(/repair round/gi)?.length??0
  };
};

const html=()=>{
  const s=memory.snapshot();
  const entries=ledger();
  const pending=s.decisions.filter(d=>d.status==="pending_approval");
  const cards=[
    ["CASH",`CHF ${s.cashChf.toFixed(2)}`],
    ["REVENUE",`CHF ${s.revenueChf.toFixed(2)}`],
    ["COSTS",`CHF ${s.costsChf.toFixed(2)}`],
    ["CYCLE",String(s.cycle)],
    ["PENDING",String(pending.length)]
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CONTROL PANEL · Autonomous Company V0.1</title>
<style>
:root{color-scheme:dark}body{font-family:Inter,system-ui,sans-serif;background:#0b0d10;color:#f4f6f8;max-width:1200px;margin:0 auto;padding:28px}
h1{margin:0 0 6px;font-size:30px}p{color:#9ca3af}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:24px 0}
.card,.panel{background:#151920;border:1px solid #252b35;border-radius:14px;padding:18px}.label{font-size:11px;color:#8b95a5;letter-spacing:1px}.value{font-size:24px;font-weight:700;margin-top:7px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}button{border:0;border-radius:9px;padding:11px 15px;background:#f4f6f8;color:#0b0d10;font-weight:700;cursor:pointer}button.warn{background:#f2c94c}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #252b35;vertical-align:top}th{color:#8b95a5;font-size:11px}.pill{padding:4px 8px;border-radius:999px;background:#252b35;font-size:11px}.approved{color:#70d6a0}.pending{color:#f2c94c}.failed{color:#ff7b7b}
small{color:#737d8c}.mono{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;white-space:pre-wrap}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}table{font-size:13px}}
</style></head><body>
<h1>CONTROL PANEL</h1><p>Autonomous Company V0.1 · Decision Ledger · Coding agent: <b>${escapeHtml(process.env.AI_CODING_AGENT_ENABLED==="true"?"AI":"deterministic")}</b></p>
<div class="grid">${cards.map(([l,v])=>`<div class="card"><div class="label">${l}</div><div class="value">${escapeHtml(v)}</div></div>`).join("")}</div>
<div class="panel"><h2>Autonomy Pipeline</h2><div class="grid" style="grid-template-columns:repeat(4,1fr);margin:12px 0 0">
${[["DECISION",pipeline().decision],["EXECUTION",pipeline().execution],["CODE REVIEW",pipeline().review],["REVIEW SCORE",pipeline().reviewScore===null?"—":String(pipeline().reviewScore)]].map(([l,v])=>`<div class="card"><div class="label">${l}</div><div class="value">${escapeHtml(v)}</div></div>`).join("")}
</div><p><small>Current stage: ${escapeHtml(pipeline().stage)} · Cycle ${pipeline().cycle}</small></p></div>
<div class="actions">
<form method="post" action="/cycle"><button>▶ Run CEO Cycle</button></form>
<form method="get" action="/api/state"><button>View State JSON</button></form>${process.env.CONTROL_PANEL_TEST_MODE==="true"?'<form method="post" action="/api/test-risk"><button class="warn">Create Risk-Gate Test</button></form>':""}
</div>
<div class="panel"><h2>Pending Approvals</h2>
${pending.length?pending.map(d=>`<div class="card" style="margin:10px 0"><b>${escapeHtml(d.action)}</b><p>${escapeHtml(d.reason)}</p><small>Risk: ${escapeHtml(d.risk)} · Budget: CHF ${d.budgetChf.toFixed(2)} · Confidence: ${Math.round(d.confidence*100)}%</small>
<form method="post" action="/approve" style="margin-top:12px"><input type="hidden" name="decisionId" value="${escapeHtml(d.id)}"><button class="warn">Approve & Execute</button></form></div>`).join(""):"<p>No human approvals required.</p>"}</div>
<div class="panel" style="margin-top:18px"><h2>Decision Ledger</h2>
<table><thead><tr><th>TIME</th><th>TYPE</th><th>STATUS</th><th>ACTION</th><th>DETAIL</th></tr></thead><tbody>
${entries.slice(0,50).map(e=>`<tr><td><small>${escapeHtml(e.timestamp)}</small></td><td>${escapeHtml(e.type)}</td><td><span class="pill ${escapeHtml(e.status)}">${escapeHtml(e.status)}</span></td><td><b>${escapeHtml(e.action)}</b></td><td>${escapeHtml(e.detail)}</td></tr>`).join("")}
</tbody></table></div>
<div class="panel" style="margin-top:18px"><h2>Latest Opportunities</h2><div class="mono">${escapeHtml(JSON.stringify(s.opportunities.slice(0,5),null,2))}</div></div>
</body></html>`;
};

const readBody=async(req:AsyncIterable<Uint8Array>)=>{
  let body=""; for await(const chunk of req) body+=chunk; return body;
};

createServer(async(req,res)=>{
  if(req.method==="GET"&&(req.url==="/"||req.url==="/control")){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"}); res.end(html()); return;
  }
  if(req.method==="GET"&&req.url==="/api/state"){
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(memory.snapshot())); return;
  }
  if(req.method==="GET"&&req.url==="/api/pipeline"){
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(pipeline())); return;
  }
  if(req.method==="GET"&&req.url==="/api/ledger"){
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(ledger())); return;
  }
  if(req.method==="POST"&&req.url==="/api/test-risk"){
    if(process.env.CONTROL_PANEL_TEST_MODE!=="true"){res.writeHead(404);res.end("Not found");return;}
    const decision={
      id:randomUUID(),cycle:memory.snapshot().cycle+1,
      action:"publish prototype to production",reason:"Control Panel risk-gate test",
      expectedOutcome:"Verify high-risk actions require explicit human approval.",
      confidence:.99,risk:"high" as const,approved:false,createdAt:new Date().toISOString(),
      opportunityId:"control-panel-risk-test",opportunityScore:0,alternatives:[],
      budgetChf:5,status:"pending_approval" as const
    };
    memory.addDecision(decision);
    res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({status:"pending_approval",decisionId:decision.id}));return;
  }
  if(req.method==="POST"&&req.url==="/cycle"){
    await runCeoDecisionLoop(memory); res.writeHead(303,{location:"/control"}); res.end(); return;
  }
  if(req.method==="POST"&&req.url==="/api/ceo-loop"){
    const result=await runCeoDecisionLoop(memory);
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(result)); return;
  }
  if(req.method==="POST"&&req.url==="/approve"){
    const body=await readBody(req); const decisionId=new URLSearchParams(body).get("decisionId");
    if(!decisionId){res.writeHead(400);res.end("decisionId required");return;}
    const decision=memory.approveDecision(decisionId);
    if(!decision){res.writeHead(404);res.end("Pending decision not found");return;}
    await executeCodeAgent(memory,decision);
    res.writeHead(303,{location:"/control"}); res.end(); return;
  }
  if(req.method==="POST"&&req.url==="/api/execute"){
    const body=await readBody(req); const payload=JSON.parse(body||"{}");
    const decision=memory.snapshot().decisions.find(d=>d.id===payload.decisionId);
    if(!decision){res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({error:"Decision not found"}));return;}
    const result=executeDecision(memory,decision);
    res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(result));return;
  }
  if(req.method==="POST"&&req.url==="/api/ai-ceo"){
    const body=await readBody(req); const answer=await askCeo(body||"Choose the best current opportunity.");
    res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({answer}));return;
  }
  res.writeHead(404); res.end("Not found");
}).listen(port,()=>console.log(`Autonomous Company V0.1 control panel running on http://localhost:${port}/control`));