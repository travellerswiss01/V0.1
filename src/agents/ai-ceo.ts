import {Agent,run} from "@openai/agents";
export async function askCeo(prompt:string):Promise<string>{
  if(!process.env.OPENAI_API_KEY)return "AI layer disabled: deterministic V0.1 policy remains active.";
  const ceo=new Agent({name:"Autonomous Company CEO",instructions:"Act as a cautious startup CEO. Optimize for profitable learning. Respect budgets. Never authorize irreversible, legal, financial, destructive or high-risk actions without human approval. Return action, reason, expected outcome and confidence.",model:"gpt-5.5"});
  const result=await run(ceo,prompt); return result.finalOutput??"CEO returned no decision.";
}