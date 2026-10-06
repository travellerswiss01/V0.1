import type {SalesChannel} from "./channel-manager.js";

export type LeadStatus = "new"|"researched"|"qualified"|"drafted"|"contacted"|"replied"|"won"|"lost";
export type ResponseIntent = "interested"|"question"|"objection"|"not_now"|"not_interested"|"unsubscribe"|"unknown";

export interface B2BLead {
  id:string;
  company:string;
  website?:string;
  contactName?:string;
  contactRole?:string;
  problem:string;
  fitScore:number;
  status:LeadStatus;
  source:string;
  notes?:string;
}

export interface CompanyResearch {
  company:string;
  evidence:string[];
  likelyPainPoints:string[];
  relevance:string;
}

export interface OutreachDraft {
  leadId:string;
  channel:SalesChannel;
  subject:string;
  body:string;
  requiresApproval:boolean;
}

export interface B2BFollowUp {
  leadId:string;
  action:"wait"|"follow_up"|"prepare_offer"|"handoff";
  reason:string;
}

export interface B2BPipelineResult {
  lead:B2BLead;
  research:CompanyResearch;
  draft:OutreachDraft;
  followUp:B2BFollowUp;
}

export class B2BSalesAgent {
  private readonly audit:string[]=[];

  scoreLead(lead:B2BLead):number {
    const base=Math.max(0,Math.min(100,lead.fitScore));
    const roleBoost=lead.contactRole?10:0;
    const websiteBoost=lead.website?5:0;
    return Math.min(100,base+roleBoost+websiteBoost);
  }

  researchCompany(lead:B2BLead):CompanyResearch {
    return {
      company:lead.company,
      evidence:[`Lead source: ${lead.source}`,`Stated problem: ${lead.problem}`],
      likelyPainPoints:[lead.problem],
      relevance:`Potential fit based on the supplied problem and lead score of ${this.scoreLead(lead)}/100.`
    };
  }

  createDraft(lead:B2BLead,research:CompanyResearch):OutreachDraft {
    const contact=lead.contactName?`Hi ${lead.contactName},`:"Hello,";
    return {
      leadId:lead.id,
      channel:"b2b",
      subject:`Idea for ${lead.company}: ${lead.problem}`,
      body:[contact,"",`I noticed a potential opportunity around ${research.likelyPainPoints[0]}.`,`I am testing a small AI/automation solution that may reduce manual work around this process.`,`If this is relevant, I can show you a short example and estimate the possible time saving.`,"","Best regards"].join("\n"),
      requiresApproval:true
    };
  }

  classifyResponse(message:string):ResponseIntent {
    const text=message.toLowerCase();
    if(/unsubscribe|remove me|do not contact|keine kontakt/.test(text))return "unsubscribe";
    if(/not interested|kein interesse|nein danke/.test(text))return "not_interested";
    if(/not now|später|later|jetzt nicht/.test(text))return "not_now";
    if(/how much|price|preis|kosten|angebot/.test(text))return "question";
    if(/interested|interesse|sounds good|klingt gut|call|termin/.test(text))return "interested";
    if(/but|aber|concern|bedenk|problem/.test(text))return "objection";
    return "unknown";
  }

  nextStep(leadId:string,intent:ResponseIntent):B2BFollowUp {
    switch(intent){
      case "interested": return {leadId,action:"handoff",reason:"Positive response: prepare human/approved sales follow-up or meeting."};
      case "question": return {leadId,action:"prepare_offer",reason:"Pricing or offer question detected; prepare an answer for approval."};
      case "objection": return {leadId,action:"prepare_offer",reason:"Objection detected; prepare a factual response for approval."};
      case "not_now": return {leadId,action:"wait",reason:"Prospect indicated a later time; schedule a bounded follow-up."};
      case "unsubscribe": return {leadId,action:"wait",reason:"Do not contact: suppress future outreach."};
      case "not_interested": return {leadId,action:"wait",reason:"Prospect declined; stop the active sequence."};
      default: return {leadId,action:"follow_up",reason:"Response unclear; prepare clarification rather than sending automatically."};
    }
  }

  run(lead:B2BLead):B2BPipelineResult {
    const research=this.researchCompany(lead);
    const scored={...lead,fitScore:this.scoreLead(lead),status:"researched" as LeadStatus};
    const draft=this.createDraft(scored,research);
    const followUp=this.nextStep(scored.id,"unknown");
    this.audit.push(`${new Date().toISOString()} ${scored.id} researched and draft prepared; approval required.`);
    return {lead:scored,research,draft,followUp};
  }

  auditLog():string[]{return [...this.audit];}
}
