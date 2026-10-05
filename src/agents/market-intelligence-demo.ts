import {researchMarket,rankMarketResearch} from "./market-intelligence.js";
import {research} from "./research.js";

const results=rankMarketResearch(research().map(researchMarket));
for(const r of results) console.log(JSON.stringify(r));
