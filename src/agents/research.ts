import type { Opportunity } from "../core/types.js";
const seeds=[
{id:"lead-response",title:"AI Lead Response",customer:"Swiss local service companies",priceChf:49,mvpDays:2,estimatedCostChf:15,competition:"medium" as const,automation:92,rationale:"Turns slow lead replies into automated follow-up and measurable conversions."},
{id:"review-content",title:"Review-to-Content Engine",customer:"Local businesses",priceChf:29,mvpDays:1,estimatedCostChf:8,competition:"high" as const,automation:95,rationale:"Repurposes customer reviews into ready-to-publish content."},
{id:"kpi-report",title:"Weekly KPI Report",customer:"Solo operators",priceChf:39,mvpDays:1,estimatedCostChf:5,competition:"medium" as const,automation:90,rationale:"Automates a recurring reporting task with clear business value."}
];
export function research():Opportunity[]{return seeds.map(o=>({...o,score:Math.round(o.automation*.45+(o.priceChf/50)*25+(o.mvpDays<=1?20:10)-(o.competition==="high"?15:5))})).sort((a,b)=>b.score-a.score);}