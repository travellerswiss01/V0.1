import type {Opportunity} from "../core/types.js";
import {researchMarket,rankMarketResearch} from "./market-intelligence.js";
export interface Evidence {query:string;title:string;source:string;url:string;snippet:string;relevance:number;}
export interface LiveResearch {opportunityId:string;queries:string[];evidence:Evidence[];baseScore:number;adjustedScore:number;}
export function buildResearchQueries(o:Opportunity):string[]{
  return [o.title+" competitors pricing Switzerland",o.customer+" "+o.title+" alternatives reviews",o.title+" market demand 2026"];
}
export function mergeEvidence(o:Opportunity,evidence:Evidence[]):LiveResearch{
  const base=researchMarket(o);
  const relevant=evidence.filter(e=>e.relevance>=.7);
  const demandBoost=Math.min(15,relevant.length*3);
  const competitionPenalty=Math.min(15,evidence.filter(e=>/pricing|competitor|alternative/i.test(e.title+" "+e.snippet)).length*2);
  const adjusted=Math.round(base.marketSizeScore*.2+(base.demandScore+demandBoost)*.2+(base.competitionScore-competitionPenalty)*.2+base.willingnessToPayScore*.15+base.automationScore*.15+base.riskScore*.1);
  return {opportunityId:o.id,queries:buildResearchQueries(o),evidence:evidence.slice(0,25),baseScore:Math.round(base.marketSizeScore*.2+base.demandScore*.2+base.competitionScore*.2+base.willingnessToPayScore*.15+base.automationScore*.15+base.riskScore*.1),adjustedScore:adjusted};
}
export function rankLiveResearch(items:LiveResearch[]){return [...items].sort((a,b)=>b.adjustedScore-a.adjustedScore);}
