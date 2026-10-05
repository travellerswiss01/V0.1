export type SalesChannel = "b2b"|"seo"|"social"|"community"|"partnerships"|"paid_ads";

export type ChannelStatus = "prepared"|"active"|"paused";

export interface ChannelConfig {
  id:SalesChannel;
  status:ChannelStatus;
  dailyBudgetChf:number;
  requiresApproval:boolean;
}

export interface ChannelEvent {
  channel:SalesChannel;
  type:"lead"|"contact"|"reply"|"qualified"|"offer"|"customer"|"revenue";
  valueChf?:number;
  timestamp:string;
}

export interface ChannelPerformance {
  channel:SalesChannel;
  leads:number;
  contacts:number;
  replies:number;
  qualified:number;
  offers:number;
  customers:number;
  revenueChf:number;
}

export class ChannelManager {
  private readonly configs:Map<SalesChannel,ChannelConfig>;
  private readonly events:ChannelEvent[]=[];

  constructor(configs:ChannelConfig[]) {
    this.configs=new Map(configs.map(config=>[config.id,config]));
  }

  getConfig(channel:SalesChannel):ChannelConfig {
    const config=this.configs.get(channel);
    if(!config) throw new Error(`Unknown sales channel: ${channel}`);
    return config;
  }

  record(event:ChannelEvent):void {
    const config=this.getConfig(event.channel);
    if(config.status!=="active") {
      throw new Error(`Channel ${event.channel} is not active.`);
    }
    this.events.push(event);
  }

  performance():ChannelPerformance[] {
    return [...this.configs.values()].map(config=>{
      const events=this.events.filter(event=>event.channel===config.id);
      const count=(type:ChannelEvent["type"])=>events.filter(event=>event.type===type).length;
      return {
        channel:config.id,
        leads:count("lead"),
        contacts:count("contact"),
        replies:count("reply"),
        qualified:count("qualified"),
        offers:count("offer"),
        customers:count("customer"),
        revenueChf:events.reduce((sum,event)=>sum+(event.type==="revenue"?event.valueChf??0:0),0)
      };
    });
  }
}

export const defaultChannelConfigs:ChannelConfig[]=[
  {id:"b2b",status:"active",dailyBudgetChf:0,requiresApproval:true},
  {id:"seo",status:"prepared",dailyBudgetChf:0,requiresApproval:true},
  {id:"social",status:"prepared",dailyBudgetChf:0,requiresApproval:true},
  {id:"community",status:"prepared",dailyBudgetChf:0,requiresApproval:true},
  {id:"partnerships",status:"prepared",dailyBudgetChf:0,requiresApproval:true},
  {id:"paid_ads",status:"prepared",dailyBudgetChf:0,requiresApproval:true}
];
