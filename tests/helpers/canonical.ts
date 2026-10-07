export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const approval = {by:"operator:test",at:"2026-10-06T12:00:00.000Z",scope:"public"} as const;
export const evidence = {sourceKind:"customer",sourceReference:"approved fixture brief",confirmation:"confirmed",visibility:"public",confirmedBy:approval.by,confirmedAt:approval.at} as const;
export const price = {mode:"fixed",amount:2500,currency:"USD",basis:"recurring",interval:"month",applicability:"component",commercialStatus:"confirmed-commercial-term",approval} as const;
export const knowledge = {entries:[{key:"audience",kind:"audience",value:"Established service businesses",evidence}],identityEvidence:[],approval};
export const offering = {summary:"A managed service",detail:"A clear public explanation",audiences:["Service businesses"],outcomes:["Useful inquiries"],inclusions:["Reviewed information"],exclusions:["Bespoke applications"],actionIds:[],thirdPartyCosts:[],evidence,approval,
  components:[{key:"ongoing",kind:"ongoing",name:"Ongoing",summary:"Continuous improvement",inclusions:[],boundaries:[],commercialRelationship:"Follows establishment",complexityNotes:[],pricing:price}]};
