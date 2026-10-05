import type {Opportunity} from "../core/types.js";

export interface MarketSignal {
  source:string;
  signal:string;
  direction:"positive"|"negative"|"neutral";
  confidence:number;
}
export interface MarketResearch {
  opportunityId:string;
  marketSizeScore:number;
  demandScore:number;
  competitionScore:number;
  willingnessToPayScore:number;
  automationScore:number;
  riskScore:number;
  signals:MarketSignal[];
  recommendation:"build"|"watch"|"reject";
  researchedAt:string;
}

export function researchMarket(opportunity:Opportunity):MarketResearch{
  const competitionScore=opportunity.competition==="low"?90:opportunity.competition==="medium"?65:35;
  const demandScore=Math.min(100,Math.round(50+opportunity.automation*.35+Math.min(opportunity.priceChf,100)*.15));
  const willingnessToPayScore=Math.min(100,Math.round(opportunity.priceChf*1.1+25));
  const automationScore=opportunity.automation;
  const marketSizeScore=Math.min(100,Math.round(45+demandScore*.35+competitionScore*.2));
  const riskScore=Math.max(0,Math.round(100-(opportunity.mvpDays*12)-(opportunity.estimatedCostChf*1.5)));
  const weighted=Math.round(marketSizeScore*.2+demandScore*.2+competitionScore*.2+willingnessToPayScore*.15+automationScore*.15+riskScore*.1);
  return {
    opportunityId:opportunity.id,marketSizeScore,demandScore,competitionScore,
    willingnessToPayScore,automationScore,riskScore,
    signals:[
      {source:"opportunity-model",signal:`MVP in ${opportunity.mvpDays} day(s)`,direction:opportunity.mvpDays<=2?"positive":"neutral",confidence:.9},
      {source:"pricing-model",signal:`CHF ${opportunity.priceChf} target price`,direction:opportunity.priceChf>=30?"positive":"neutral",confidence:.8},
      {source:"competition-model",signal:`${opportunity.competition} competition`,direction:opportunity.competition==="high"?"negative":"positive",confidence:.75}
    ],
    recommendation:weighted>=72?"build":weighted>=55?"watch":"reject",
    researchedAt:new Date().toISOString()
  };
}

export function rankMarketResearch(items:MarketResearch[]):MarketResearch[]{
  return [...items].sort((a,b)=>{
    const score=x=>x.marketSizeScore*.2+x.demandScore*.2+x.competitionScore*.2+x.willingnessToPayScore*.15+x.automationScore*.15+x.riskScore*.1;
    return score(b)-score(a);
  });
}
