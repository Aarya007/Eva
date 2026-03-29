import * as basicInfo from "./basicInfo.js";
import * as medical from "./medical.js";
import * as lifestyle from "./lifestyle.js";
import * as eating from "./eating.js";
import * as goals from "./goals.js";
import * as measurements from "./measurements.js";
import * as personalization from "./personalization.js";

export const STEPS = [
  { id: "basic", title: "Basic", render: basicInfo.render },
  { id: "medical", title: "Medical", render: medical.render },
  { id: "lifestyle", title: "Lifestyle", render: lifestyle.render },
  { id: "eating", title: "Eating", render: eating.render },
  { id: "goals", title: "Goals", render: goals.render },
  { id: "measurements", title: "Measurements", render: measurements.render },
  { id: "personalization", title: "Personalization", render: personalization.render },
];
