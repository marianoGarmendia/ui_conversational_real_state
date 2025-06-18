import {
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessageLike,
} from "@langchain/core/messages";
// import { v4 as uuidv4 } from "uuid";
import "@langchain/langgraph/zod";
import {
  ActionRequest,
  HumanInterrupt,
  HumanInterruptConfig,
  HumanResponse,
} from "@langchain/langgraph/prebuilt";

import {
  typedUi,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { formatMessages } from "../utils/formatted-messages.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {propFinderTool, PropFinderSchema} from "./tools/propFinder.js"

import { obtener_info_usuario }  from "../utils/tools.js";
import {z} from "zod";

import dotenv from "dotenv";
dotenv.config();

interface InfoUsuario {
  nombre?: string;
  email?: string;
  telefono?: string;
}

const tools = [obtener_info_usuario , propFinderTool];

const stateAnnotation = MessagesAnnotation;


/*

Asi se declara un state cuando vas a interactar con la ui 

*/

type NavAction = "next" | "prev";

const newState = Annotation.Root({
  ...stateAnnotation.spec,
  summary: Annotation<string>,
  info_usuario: Annotation<InfoUsuario>,
  property: Annotation<object>,
  interruptResponse: Annotation<string>,
  action: Annotation<NavAction>,
 ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),

});

export const model = new ChatOpenAI({
  model: "gpt-4o",
  streaming: false,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
}).bindTools(tools);

// const toolNode = new ToolNode(tools);

async function callModel(
  state: typeof newState.State,
  config: LangGraphRunnableConfig
) {
  const { messages } = state;

  // const ui = typedUi(config);

  // console.log("sumary agent en callModel");
  // console.log("-----------------------");
  // console.log(summary);
  const conversation = formatMessages(messages);
  const systemsMessage = new SystemMessage(
    `
  🔹 Prompt para Carla, agente IA Real Estate de Inmobiliaria MyM

Nombre del agente: Carla
Personalidad: Cercana, clara y confiable. Su tono es profesional pero cálido, como una asesora experta en bienes raíces que busca realmente ayudar al usuario a encontrar lo que mejor se ajuste a sus necesidades.
Objetivo: Guiar al usuario en la búsqueda de propiedades para compra o alquiler, usando la herramienta propFinder, dando recomendaciones informadas sobre zonas, precios y tipos de propiedades en Barcelona y alrededores.
Ámbito geográfico de especialización: Barcelona ciudad, Gavà Mar, Castelldefels, Sitges, Hospitalet de Llobregat, Badalona y otros barrios de interés para vivir o invertir.
Interfaz del usuario: Visual con cards de propiedades en pantalla, con funcionalidad tipo carousel (siguiente/anterior). Carla puede preguntar si está viendo las opciones, referirse a las propiedades por su ubicación y guiar con comandos como “di siguiente” o “di anterior”.

💬 Comportamiento Conversacional de Carla

Inicio de conversación amigable:

“Hola, soy Carla, tu asesora inmobiliaria virtual. ¿Estás buscando comprar o alquilar una propiedad por Barcelona o alrededores?”

Recopilación de criterios paso a paso para propFinder:

“¿Qué tipo de propiedad estás buscando? Puede ser un piso, una casa o un departamento.”

“¿Tienes una zona en mente? Puede ser algo cerca del mar como Castelldefels, o más céntrico como Eixample.”

“¿Cuántas habitaciones te gustaría que tenga la propiedad?”

“¿Qué presupuesto tenés en mente para esta búsqueda?”

(Confirmar) “Perfecto, con eso ya puedo mostrarte algunas opciones interesantes.”

### Herramienta para utilizar en la búsqueda de propiedades:

Esquema de herramienta:

const propFinderSchema = z.object({
    cantidad_de_habitaciones: z.number().describe("Cantidad de habitaciones que solcita el usuario"),
    presupuesto: z.number().describe("Presupuesto aproximado que el usuario tiene disponible para la compra o alquiler de una propiedad"),
    tipo_de_propiedad: z.string().describe("Tipo de propiedad que el usuario desea (casa, departamento, piso)"),
    ubicacion: z.string().describe("Ubicación deseada por el usuario para la propiedad, puede ser una ciudad, barrio, zona específica o puede decir, cercano al mar o al centro de la ciudad"),
    tipo_de_operacion: z.enum(["compra", "alquiler"]).describe("Tipo de operación que el usuario desea realizar, ya sea compra o alquiler de la propiedad"),
})

{
    name: "propFinder",
    description: "Buscar propiedades según los criterios del usuario para la compra o alquiler",
    schema: propFinderSchema,
    }

    ---------------------

Presentación de resultados de forma dinámica y visual-aware:

- No empieces a describir cada una, preguntale primero si está viendo las opciones y cual le interesa para que le puedas contar más, sumado a eso puedes decirle que diga "siguiente" o "atrás" para avanzar o retroceder en las opciones.

“Te muestro algunas opciones por pantalla. Empecemos con la primera: una propiedad en Castelldefels, a pocos minutos caminando de la playa…”

*En la respuesta de la herramienta tendras en orden las propiedades que se le van a estar mostrando al usuario por pantalla, con su imagen, ubicación, precio y características principales.*

“¿La estás viendo? Si querés saber más, decímelo. También podés decir ‘siguiente’ para ver otra opción o ‘anterior’ para volver.”

Consejo contextual cuando sea útil:



“Para vida familiar, Gavà Mar es una excelente opción por su tranquilidad y cercanía al mar.”


contextualización de la conversación:
${conversation}




    `
  );

  const response = await model.invoke([systemsMessage, ...messages]);

  // console.log("response: ", response);

  // const cadenaJSON = JSON.stringify(messages);
  // Tokeniza la cadena y cuenta los tokens
  // const tokens = encode(cadenaJSON);
  // const numeroDeTokens = tokens.length;

  // console.log(`Número de tokens: ${numeroDeTokens}`);

  return { messages: [response] };

  // console.log(messages, response);

  // We return a list, because this will get added to the existing list
}

// Asi debe verse el ui items
// ui items: [
//   {
//     type: 'ui',
//     id: '078dd3e2-55d8-4c6b-a816-f215ca86e438',
//     name: 'accommodations-list',
//     props: {
//       toolCallId: 'call_HKFTSQQKIWPAJI8JUn5SJei9',
//       tripDetails: [Object],
//       accommodations: [Array]
//     },
//     metadata: {
//       merge: undefined,
//       run_id: '1ed83f9a-d953-4527-9e5b-1474fca72355',
//       tags: [],
//       name: undefined,
//       message_id: 'chatcmpl-BTb6SQ2iOOpI0WoEfdke1uDgAydt6'
//     }
//   },

function shouldContinue(
  state: typeof newState.State,
  config: LangGraphRunnableConfig
) {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1] as AIMessage;
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.tool_calls?.length) {
    return "tools";
  } else {
    console.log("end of conversation");

    return END;
  }

  // Otherwise, we stop (reply to the user)
}

// const products = [
//   {
//     agente: "M&M .",
//     alrededores: "Bus:\nTren:\nRestaurantes:\nAeropuerto:",
//     banios: 1,
//     caracteristicas: [
//       "Planta 1",
//       "Aparcamiento",
//       "Terraza",
//       "Buen Estado",
//       "Comunidad:  0",
//       "Ventanas: Aluminio",
//       "Cocina: Independiente",
//       "Ubicación: Céntrico",
//     ],
//     circunstancia: "No Disponible",
//     ciudad: "Gava",
//     cocina: "Independiente",
//     codigo_postal: 8850,
//     construccion_nueva: 0,
//     consumo_energia: 0,
//     direccion: "Calle Sarria, 11, puerta 2",
//     dormitorios: 3,
//     emisiones: 0,
//     estado: "No Disponible",
//     estgen: "Buen Estado",
//     fecha_alta: "2024-04-26 00:00:00",
//     freq_precio: "sale",
//     "geolocalizacion.latitude": 41.30558,
//     "geolocalizacion.longitude": 2.00845,
//     id: "1985",
//     image_url:
//       "https://crm904.inmopc.com/INMOWEB-PHP/base/fotos/inmuebles/98475/9847513104_5.jpg",
//     m2constr: 0,
//     m2terraza: 0,
//     m2utiles: 82,
//     moneda: "EUR",
//     nascensor: 0,
//     ntrasteros: 0,
//     num_inmueble: 11,
//     num_pisos_bloque: 0,
//     num_pisos_edificio: 0,
//     num_planta: "1ª Planta",
//     num_terrazas: 1,
//     pais: "spain",
//     piscina: 1,
//     precio: 208000,
//     "propietario.apellido": "David",
//     "propietario.codigo": 51,
//     "propietario.comercial": "M&M .",
//     "propietario.fecha_alta": "03/11/2023",
//     "propietario.nombre": "Maria",
//     provincia: "Barcelona",
//     puerta: 2,
//     ref: 3092,
//     "superficie.built": 0,
//     "superficie.plot": 0,
//     tipo: "piso",
//     tipo_operacion: "Venta",
//     tipo_via: "Calle",
//     ubicacion: "Céntrico",
//     ventana: "Aluminio",
//     zona: "Centre",
//     url: "https://propiedades.winwintechbank.com/#/producto/1985",
//   },
// ];

const humanNodeBooking = (lastMessage: AIMessage) => {
  if (lastMessage.tool_calls) {
    const toolArgs = lastMessage.tool_calls[0].args as {
      name: string;
      start: string;
      email: string;
    };
    const { name, start, email } = toolArgs;
    const actionRequest: ActionRequest = {
      action: "Confirma la reserva",
      args: toolArgs,
    };

    const date = new Date(start);

    // Fecha y hora completas
    const stringNormalized = date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const description = `Por favor, confirma la reserva de la propiedad con los siguientes parámetros: ${JSON.stringify(
      {
        name,
        stringNormalized,
        email,
      }
    )}`;

    const interruptConfig: HumanInterruptConfig = {
      allow_ignore: false, // Allow the user to `ignore` the interrupt
      allow_respond: false, // Allow the user to `respond` to the interrupt
      allow_edit: true, // Allow the user to `edit` the interrupt's args
      allow_accept: true, // Allow the user to `accept` the interrupt's args
    };

    const request: HumanInterrupt = {
      action_request: actionRequest,
      config: interruptConfig,
      description,
    };

    const humanResponse = interrupt<HumanInterrupt[], HumanResponse[]>([
      request,
    ])[0];

    if (humanResponse.type === "response") {
      const message = `User responded with: ${humanResponse.args}`;
      return { interruptResponse: message, humanResponse: humanResponse.args };
    } else if (humanResponse.type === "accept") {
      const message = `User accepted with: ${JSON.stringify(
        humanResponse.args
      )}`;
      return { interruptResponse: message, humanResponse: humanResponse };
    } else if (humanResponse.type === "edit") {
      const message = `User edited with: ${JSON.stringify(humanResponse.args)}`;
      return { interruptResponse: message, humanResponse: humanResponse.args };
    } else if (humanResponse.type === "ignore") {
      const message = "User ignored interrupt.";
      return { interruptResponse: message, humanResponse: humanResponse };
    }

    return {
      interruptResponse:
        "Unknown interrupt response type: " + JSON.stringify(humanResponse),
    };
  }
};

const humanNode = (lastMessage: any) => {
  const toolArgs = lastMessage.tool_calls[0].args as {
    habitaciones: string | null;
    precio_aproximado: string;
    zona: string;
    superficie_total: string | null;
    piscina: "si" | "no" | null;
    tipo_operacion: "venta" | "alquiler";
  };

  const {
    habitaciones,
    precio_aproximado,
    zona,
    piscina,
    superficie_total,
    tipo_operacion,
  } = toolArgs;

  // Define the interrupt request
  const actionRequest: ActionRequest = {
    action: "Confirma la búsqueda",
    args: toolArgs,
  };

  const description = `Por favor, confirma la búsqueda de propiedades con los siguientes parámetros: ${JSON.stringify(
    {
      habitaciones,
      precio_aproximado,
      zona,
      piscina,
      superficie_total,
      tipo_operacion,
    }
  )}`;

  const interruptConfig: HumanInterruptConfig = {
    allow_ignore: false, // Allow the user to `ignore` the interrupt
    allow_respond: false, // Allow the user to `respond` to the interrupt
    allow_edit: true, // Allow the user to `edit` the interrupt's args
    allow_accept: true, // Allow the user to `accept` the interrupt's args
  };

  const request: HumanInterrupt = {
    action_request: actionRequest,
    config: interruptConfig,
    description,
  };

  const humanResponse = interrupt<HumanInterrupt[], HumanResponse[]>([
    request,
  ])[0];
  console.log("request: ", request);

  console.log("humanResponse: ", humanResponse);

  if (humanResponse.type === "response") {
    const message = `User responded with: ${humanResponse.args}`;
    return { interruptResponse: message, humanResponse: humanResponse.args };
  } else if (humanResponse.type === "accept") {
    const message = `User accepted with: ${JSON.stringify(humanResponse.args)}`;
    return { interruptResponse: message, humanResponse: humanResponse };
  } else if (humanResponse.type === "edit") {
    const message = `User edited with: ${JSON.stringify(humanResponse.args)}`;
    return { interruptResponse: message, humanResponse: humanResponse.args };
  } else if (humanResponse.type === "ignore") {
    const message = "User ignored interrupt.";
    return { interruptResponse: message, humanResponse: humanResponse };
  }

  return {
    interruptResponse:
      "Unknown interrupt response type: " + JSON.stringify(humanResponse),
  };
};

interface booking {
  name: string;
  start: string;
  email: string;
}

interface pisosToolArgs {
  habitaciones: string | null;
  precio_aproximado: string;
  zona: string;
  superficie_total: string | null;
  piscina: "si" | "no" | null;
  tipo_operacion: "venta" | "alquiler";
}

const toolNodo = async (
  state: typeof newState.State,
  config: LangGraphRunnableConfig
) => {
  const { messages } = state;
  const ui = typedUi(config);
  const lastMessage = messages[messages.length - 1] as AIMessage;
  console.log("toolNodo");
  console.log("-----------------------");
  // console.log(lastMessage);
  // console.log(lastMessage?.tool_calls);
  let toolMessage: BaseMessageLike;

  if (lastMessage?.tool_calls?.length) {
    const lastMessageID = lastMessage.id as string;
    const toolName = lastMessage.tool_calls[0].name;
    const toolArgs = lastMessage.tool_calls[0].args as pisosToolArgs & {
      query: string;
    } & { startTime: string; endTime: string } & {
      name: string;
      start: string;
      email: string;
    } & PropFinderSchema ;
    let tool_call_id = lastMessage.tool_calls[0].id as string;

    // Manejas la llamada a herramienta y el renderizado de props
    if(toolName === "propFinder") {
      const response =  await propFinderTool.invoke(toolArgs)
      if(response.toolMessage && response.items) {

         const metadata = {
        message_id: lastMessage.id, // Aseguramos que el id del mensaje sea el correcto
      };


        ui.push(
        {
          name: "carCarousel",
          props: { props: response.items, user: { nombre: "Mariano" } },
          metadata: {
            ...metadata, // Aseguramos que el id del mensaje sea el correcto
          },
        },
        { merge: true, message: lastMessage }
      );

      console.log("ui.items: ", ui.items);

        return {
          ui: ui.items,
          messages:[response.toolMessage]
        }
   
      }

    }
    
  } else {
    toolMessage = new ToolMessage(
      "No pude gestionar esta herramienta, probemos de nuevo",
      lastMessage.id as string,
      "error"
    );
    return {
      ui: [],
      messages: [toolMessage],
      timestamp: Date.now(),
    };
  }
};
// if (toolName === "Obtener_pisos_en_venta_dos") {
//   const responseInterrupt = humanNode(lastMessage);
//   if (
//     responseInterrupt.humanResponse &&
//     typeof responseInterrupt.humanResponse !== "string" &&
//     responseInterrupt.humanResponse.args
//   ) {
//     const toolArgsInterrupt = responseInterrupt.humanResponse
//       .args as pisosToolArgs;
//     const response = await getPisos2.invoke(toolArgsInterrupt);
//     if (typeof response !== "string") {
//       toolMessage = new ToolMessage(
//         "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
//         tool_call_id,
//         "Obtener_pisos_en_venta_dos",
//       );
//     } else {
//       toolMessage = new ToolMessage(
//         response,
//         tool_call_id,
//         "Obtener_pisos_en_venta_dos",
//       );
//     }
//   }
// } else if (toolName === "universal_info_2025") {
// const res = await pdfTool.invoke(toolArgs);
// toolMessage = new ToolMessage("res", tool_call_id, "universal_info_2025");
// }

//     if (toolName === "getAvailabilityTool") {
//       const res = await getAvailabilityTool.invoke(toolArgs);
//       toolMessage = new ToolMessage(res, tool_call_id, "getAvailabilityTool");
//     } else if (toolName === "createbookingTool") {
//       const responseInterruptBooking = humanNodeBooking(lastMessage);
//       if (
//         responseInterruptBooking?.humanResponse &&
//         typeof responseInterruptBooking.humanResponse !== "string" &&
//         responseInterruptBooking.humanResponse.args
//       ) {
//         const toolArgsInterrupt = responseInterruptBooking.humanResponse
//           .args as ActionRequest;
//         console.log("tollArgsInterrupt: ", toolArgsInterrupt);
//         if (toolArgsInterrupt.args) {
//           const { name, start, email } = toolArgsInterrupt.args as booking;
//           const response = await createbookingTool.invoke({
//             name,
//             start,
//             email,
//           });
//           if (typeof response !== "string") {
//             toolMessage = new ToolMessage(
//               "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
//               tool_call_id,
//               "createbookingTool",
//             );
//           } else {
//             toolMessage = new ToolMessage(
//               response,
//               tool_call_id,
//               "createbookingTool",
//             );
//           }
//         } else {
//           toolMessage = new ToolMessage(
//             "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
//             tool_call_id,
//             "createbookingTool",
//           );
//         }
//       } else {
//         toolMessage = new ToolMessage(
//           "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
//           tool_call_id,
//           "createbookingTool",
//         );
//       }
//     } else if (toolName === "products_finder") {
//       const res = await productsFinder.invoke({
//         ...toolArgs,
//         props: INMUEBLE_PROPS,
//       } as any); // @ts-ignore
//       toolMessage = res.message as ToolMessage;

//       ui.push({
//         name: "products-carousel",
//         props: {// @ts-ignore
//           items: [...res.item],
//           toolCallId: tool_call_id,
//         },
//         metadata: {
//           message_id: lastMessageID,
//         },
//       });
//     }
//   } else {
//     const toolMessages = lastMessage.tool_calls?.map((call) => {
//       return new ToolMessage(
//         "No pude gestionar esta herramienta, probemos de nuevo",
//         call.id as string,
//         `${call?.name}`,
//       );
//     });

//     if (!toolMessages || toolMessages.length === 0) {
//       toolMessage = new ToolMessage(
//         "No pude gestionar esta herramienta, probemos de nuevo",
//         lastMessage.id as string,
//         "error",
//       );
//       return { messages: [...messages, toolMessage] };
//     } else {
//       return { messages: [...messages, ...toolMessages] };
//     }
//   }
//   // tools.forEach((tool) => {
//   //   if (tool.name === toolName) {
//   //     tool.invoke(lastMessage?.tool_calls?[0]['args']);
//   //   }
//   // });
//   // console.log("toolMessage: ", toolMessage);
// //@ts-ignore
// return { ui: ui.items, messages: [ ...toolMessage]  , timestamp: Date.now() };

// const delete_messages = async (state: typeof newState.State) => {
//   const { messages, summary } = state;
//   console.log("delete_messages");
//   console.log("-----------------------");

//   console.log(messages);

//   let summary_text = "";

//   let messages_parsed: any[] = [];
//   messages_parsed = messages.map((message) => {
//     if (message instanceof AIMessage) {
//       return {
//         ...messages_parsed,
//         role: "assistant",
//         content: message.content,
//       };
//     }
//     if (message instanceof HumanMessage) {
//       return { ...messages_parsed, role: "Human", content: message.content };
//     }
//   });

//   // 1. Filtrar elementos undefined
//   const filteredMessages = messages_parsed.filter(
//     (message) => message !== undefined
//   );

//   // 2. Formatear cada objeto
//   const formattedMessages = filteredMessages.map(
//     (message) => `${message.role}: ${message.content}`
//   );

//   // 3. Unir las cadenas con un salto de línea
//   const prompt_to_messages = formattedMessages.join("\n");

//   if (messages.length > 3) {
//     if (!summary) {
//       const intructions_summary = `Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación. Por favor, analiza cada mensaje y elabora un resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo
//         mensajes: ${prompt_to_messages}
//         `;

//       const summary_message = await model.invoke(intructions_summary);
//       summary_text = summary_message.content as string;
//     } else {
//       const instructions_with_summary = `"Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación y además tener en cuenta el resumen previo de dicha conversación. Por favor, analiza cada mensaje y el resumen y elabora un nuevo resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo.

//       mensajes: ${prompt_to_messages}

//       resumen previo: ${summary}

//       `;

//       const summary_message = await model.invoke(instructions_with_summary);

//       summary_text = summary_message.content as string;
//     }

//     const mssageReduced = messages.slice(0, -3).map((message) => {
//       return new RemoveMessage({ id: message.id as string });
//     });

//     const messagesChecked = ensureToolCallsHaveResponses(mssageReduced);

//     return {
//       messages: [...messagesChecked],
//       summary: summary_text,
//     };
//   }
//   return { messages };
// };

// const captionAction = async (state: typeof newState.State) => {
//   const { messages, action } = state;

//   console.log("action: ", action);

  
//     const result = await leadQualifierChain.invoke({
//       messages: messages,
//     });

//     console.log(
//       `📊 Lead calificado - Score: ${result.score}/10, Calificado: ${result.calificado}`
//     );
//     console.log(`💡 Razón: ${result.razon}`);
//     console.log(`🎯 Siguiente acción: ${result.siguiente_accion}`);

//     return {
//       leadQualifier: result,
//       messages: [...messages],
//     };
//   } catch (error) {
//     console.error("Error al calificar lead:", error);
//     return {
//       messages: [...messages],
//       action: "error",
//       leadQualification: {
//         score: 1,
//         calificado: false,
//         razon: "Error en el sistema de calificación",
//         siguiente_accion: "Contactar soporte técnico",
//       },
//     };
//   }
// };

const graph = new StateGraph(newState);

graph
  .addNode("agent", callModel)
  .addNode("tools", toolNodo)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();

export const workflow = graph.compile({ checkpointer });
// let config = { configurable: { thread_id: "123" } };

// const response = await workflow.invoke({messages:"dame las noticias ams relevantes de este 2025"}, config)

// console.log("response: ", response);

// const response =  workflow.streamEvents({messages: [new HumanMessage("Hola como estas? ")]}, {configurable: {thread_id: "1563"} , version: "v2" });
// console.log("-----------------------");
// console.log("response: ", response);

// await workflow.stream({messages: [new HumanMessage("Podes consultar mi cobertura?")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// console.log("-----------------------");

// await workflow.stream({messages: [new HumanMessage("Mi dni es 32999482, tipo dni")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// for await (const message of response) {

//   // console.log(message);
//   // console.log(message.content);
//   // console.log(message.tool_calls);

//   console.dir({
//     event: message.event,
//     messages: message.data,

//   },{
//     depth: 3,
//   });
// }

// for await (const message of response) {
//   // console.log(message);

//   console.dir(message, {depth: null});
// }

// await workflow.stream(new Command({resume: true}));

// Implementacion langgraph studio sin checkpointer
// export const workflow = graph.compile();

// MODIFICAR EL TEMA DE HORARIOS
// En el calendar de cal esta configurado el horario de bs.as.
// El agente detecta 3hs mas tarde de lo que es en realidad es.
// Ejemplo: si el agente detecta 16hs, en realidad es 13hs.
// Para solucionar este problema, se debe modificar el horario de la herramienta "create_booking_tool".
// En la herramienta "create_booking_tool" se debe modificar el horario de la variable "start".
// En la variable "start" se debe modificar la hora de la reserva.
