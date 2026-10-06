import type {SalesChannel,ChannelEvent} from "../sales/channel-manager.js";
import {ChannelManager} from "../sales/channel-manager.js";
import type {B2BLead,B2BPipelineResult} from "../sales/b2b-sales-agent.js";
import {B2BSalesAgent} from "../sales/b2b-sales-agent.js";

export interface GrowthPlan { opportunityId:string; targetCustomer:string; offer:string; primaryChannel:SalesChannel; dailyBudgetChf:number; requiresApproval:boolean; successMetrics:string[]; }
export interface GrowthResult { plan:GrowthPlan; pipeline?:B2BPipelineResult; events:ChannelEvent[]; status:"prepared"|"blocked"; reason:string; }

export class GrowthAgent {
  constructor(private readonly channels=new ChannelManager([
    {id:"b2b",status:"active",dailyBudgetChf:0,requiresApproval:true},{id:"seo",status:"prepared",dailyBudgetChf:0,requiresApproval:true},{id:"social",status:"prepared",dailyBudgetChf:0,requiresApproval:true},{id:"community",status:"prepared",dailyBudgetChf:0,requiresApproval:true},{id:"partnerships",status:"prepared",dailyBudgetChf:0,requiresApproval:true},{id:"paid_ads",status:"prepared",dailyBudgetChf:0,requiresApproval:true}
  ]),private readonly sales=new B2BSalesAgent()){}

  prepare(plan:GrowthPlan,lead?:B2BLead):GrowthResult {
    if(plan.dailyBudgetChf<0) throw new Error("Growth budget cannot be negative.");
    if(plan.primaryChannel==="paid_ads" && plan.dailyBudgetChf>0) return {plan,events:[],status:"blocked",reason:"Paid acquisition requires explicit human approval before spend."};
    if(plan.primaryChannel==="b2b" && lead) return {plan,pipeline:this.sales.run(lead),events:[],status:"prepared",reason:"Outreach draft prepared; no message is sent automatically."};
    return {plan,events:[],status:"prepared",reason:"Growth plan prepared; external outreach and spend remain approval-gated."};
  }
  recordEvent(event:ChannelEvent){this.channels.record(event);}
  performance(){return this.channels.performance();}
}
