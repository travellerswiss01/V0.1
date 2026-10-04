import {createServer} from "node:http";
import {Memory} from "./core/memory.js";
import {runCeoCycle} from "./agents/ceo.js";
import {executeDecision} from "./agents/executor.js";
import {askCeo} from "./agents/ai-ceo.js";

const port=Number(process.env.PORT||3000);
const memory=new Memory(Number(process.env.STARTING_CAPITAL_CHF||100));

const html=()=>{
  const s=memory.snapshot();
  return `<!doctype html><html><head><meta charset="utf-8"><title>Autonomous Company V0.1</title>
  <style>body{font-family:system-ui;max-width:1000px;margin:40px auto;padding:0 20px}button{padding:10px 16px;margin:4px 0}pre{background:#f4f4f4;padding:16px;overflow:auto}</style>
  </head><body><h1>Autonomous Company V0.1</h1>
  <p>Cycle: <b>${s.cycle}</b> · Cash: <b>CHF ${s.cashChf.toFixed(2)}</b> · Costs: <b>CHF ${s.costsChf.toFixed(2)}</b> · Revenue: CHF ${s.revenueChf.toFixed(2)}</p>
  <p>Coding agent: <b>${process.env.AI_CODING_AGENT_ENABLED==="true"?"AI":"deterministic"}</b></p>
  <form method="post" action="/cycle"><button>Run CEO cycle + coding agent</button></form>
  <h2>Opportunities</h2><pre>${JSON.stringify(s.opportunities,null,2)}</pre>
  <h2>Decisions</h2><pre>${JSON.stringify(s.decisions,null,2)}</pre>
  <h2>Executions</h2><pre>${JSON.stringify(s.executions,null,2)}</pre>
  </body></html>`;
};

createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    res.end(html()); return;
  }
  if(req.method==="GET"&&req.url==="/api/state"){
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify(memory.snapshot())); return;
  }
  if(req.method==="POST"&&req.url==="/cycle"){
    await runCeoCycle(memory);
    res.writeHead(303,{location:"/"});
    res.end(); return;
  }
  if(req.method==="POST"&&req.url==="/api/execute"){
    let body=""; for await(const chunk of req) body+=chunk;
    const payload=JSON.parse(body||"{}");
    const decision=memory.snapshot().decisions.find(d=>d.id===payload.decisionId);
    if(!decision){
      res.writeHead(404,{"content-type":"application/json"});
      res.end(JSON.stringify({error:"Decision not found"})); return;
    }
    const result=executeDecision(memory,decision);
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify(result)); return;
  }
  if(req.method==="POST"&&req.url==="/api/ai-ceo"){
    let body=""; for await(const chunk of req) body+=chunk;
    const answer=await askCeo(body||"Choose the best current opportunity.");
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({answer})); return;
  }
  res.writeHead(404); res.end("Not found");
}).listen(port,()=>console.log(`Autonomous Company V0.1 running on http://localhost:${port}`));