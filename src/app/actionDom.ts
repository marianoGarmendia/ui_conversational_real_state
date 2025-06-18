
// import { z } from "zod";
// import { ChatAnthropic } from "@langchain/anthropic";
// import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
// import dotenv from "dotenv";
// dotenv.config();

// // Sistema de calificación de leads
// const leadQualificationPrompt = `
// Eres un experto en calificación de leads para una empresa de alquiler de autos.

// Tu tarea es evaluar la calidad del lead basándote en la conversación que has tenido hasta ahora.

// Evalúa estos criterios:

// 1. **Intención de compra** (0-3 puntos):
//    - ¿El cliente muestra interés real en alquilar?
//    - ¿Ha hecho preguntas específicas sobre precios, disponibilidad o características?
//    - ¿Ha mencionado fechas concretas o planes de viaje?

// 2. **Información proporcionada** (0-3 puntos):
//    - ¿Ha proporcionado detalles sobre sus necesidades (fechas, tipo de auto, pasajeros)?
//    - ¿Ha respondido a preguntas de calificación?
//    - ¿Ha compartido información de contacto o personal?

// 3. **Capacidad de decisión** (0-2 puntos):
//    - ¿Parece tener autoridad para tomar la decisión?
//    - ¿Ha mencionado presupuesto o no tiene restricciones económicas aparentes?

// 4. **Urgencia/Timeline** (0-2 puntos):
//    - ¿Tiene un timeline definido para el alquiler?
//    - ¿La fecha de alquiler está próxima?
//    - ¿Ha expresado urgencia en su solicitud?

// Asigna un puntaje del 1 al 10 basándote en estos criterios.

// Puntajes de referencia:
// - 1-3: Lead frío, solo exploración inicial
// - 4-6: Lead tibio, cierto interés pero falta información
// - 7-8: Lead caliente, interés serio y buena información
// - 9-10: Lead muy caliente, listo para comprar

// Analiza la conversación y proporciona tu evaluación.
// `;

// const leadQualificationTool = {
//   name: "qualify_lead",
//   description: "Evalúa y califica un lead basándose en la conversación.",
//   schema: z.object({
//     score: z.number().min(1).max(10).describe("Puntaje de calificación del lead del 1 al 10"),
//     calificado: z.boolean().describe("True si el lead está calificado (score > 6)"),
//     razon: z.string().describe("Explicación breve del puntaje asignado"),
//     siguiente_accion: z.string().describe("Acción recomendada para este lead"),
//   }),
// };

// const prompt = ChatPromptTemplate.fromMessages([
//   ["system", leadQualificationPrompt],
//   new MessagesPlaceholder("messages"),
//   [
//     "human",
//     "Basándote en la conversación anterior, evalúa este lead y proporciona un puntaje de calificación.",
//   ],
// ]);



// const llm = new ChatAnthropic({
//   modelName: "claude-3-5-sonnet-20241022",
//   temperature: 0,
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// export const leadQualifierChain = prompt
//   .pipe(llm.bindTools([leadQualificationTool], { tool_choice: "qualify_lead" }))
//   .pipe((x:any) => {
//     const result = x.tool_calls[0].args;
//     // Asegurar que calificado sea true si score > 6
//     result.calificado = result.score > 6;
//     return result;
//   });

//   // Asi se configura con el nodo calificador:

//   //  .addNode("callModel", callModel)
//   // .addNode("tools", toolNode)
//   // .addNode("leadQualifierNode", leadQualifierNode)
//   // .addEdge("__start__", "leadQualifierNode")
//   // .addEdge("leadQualifierNode", "callModel")
//   // .addConditionalEdges("callModel", routeModelOutput, ["tools", "__end__"])
//   // .addEdge("tools", "callModel");