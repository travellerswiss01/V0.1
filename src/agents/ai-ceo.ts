import {Agent,run} from "@openai/agents";
import {Memory} from "../core/memory.js";
import {createCeoTools} from "./ceo-tools.js";

export function createCeoAgent(memory?:Memory){
  return new Agent({
    name:"Autonomous Company CEO",
    instructions:"Act as a cautious startup CEO. Optimize for profitable learning. Inspect company state and memory before acting. Respect budgets. Never authorize irreversible, legal, financial, destructive or high-risk actions without human approval. Use the provided company tools for real state changes; never invent execution results.",
    model:process.env.OPENAI_CEO_MODEL||"gpt-5.5",
    tools:memory?createCeoTools(memory):[]
  });
}

export async function askCeo(prompt:string,memory?:Memory):Promise<string>{
  if(!process.env.OPENAI_API_KEY)return "AI layer disabled: deterministic V0.1 policy remains active.";
  const ceo=createCeoAgent(memory);
  const result=await run(ceo,prompt);
  return result.finalOutput??"CEO returned no decision.";
}
