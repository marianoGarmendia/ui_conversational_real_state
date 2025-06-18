import {tool} from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import {ToolMessage} from "@langchain/core/messages";
import {
  typedUi
} from "@langchain/langgraph-sdk/react-ui/server";
import { workflow } from "../inmo.js";
import { z } from "zod";


 const propFinderSchema = z.object({
    cantidad_de_habitaciones: z.number().describe("Cantidad de habitaciones que solcita el usuario"),
    presupuesto: z.number().describe("Presupuesto aproximado que el usuario tiene disponible para la compra o alquiler de una propiedad"),
    tipo_de_propiedad: z.string().describe("Tipo de propiedad que el usuario desea (casa, departamento, piso)"),
    ubicacion: z.string().describe("Ubicación deseada por el usuario para la propiedad, puede ser una ciudad, barrio, zona específica o puede decir, cercano al mar o al centro de la ciudad"),
    tipo_de_operacion: z.enum(["compra", "alquiler"]).describe("Tipo de operación que el usuario desea realizar, ya sea compra o alquiler de la propiedad"),
})

export type PropFinderSchema = z.infer<typeof propFinderSchema>;


const getProps = async () => {
    try {
        const response = await fetch("https://propiedades.techbank.ai:4001/public/productos/compact"); // Reemplaza con la URL real de tu API
        if(!response.ok) {
           console.error("Error en la respuesta de la API:", response.statusText);
           return [];
        }

        const data = await response.json();
        return data 
    } catch (error:any) {
       console.error("Error al obtener las propiedades:", error.message);
       return [];
    }
}

type Inmueble = {
  PROPS: {
    descripcion: string;
    dormitorios: string;
    precio: string;
    tipo: string;
    zona?: string;
    [key: string]: any;
  };
  R_IMG: { LOCATION: string }[];
};

type Requisitos = {
  dormitorios?: number;
  presupuesto?: number;
  tipo?: string;
  zona?: string;
};

type Scored = Inmueble & { score: number };

function filtrarYOrdenar(
  inmuebles: Inmueble[],
  req: Requisitos
): Scored[] {
  const margin = 0.15;

  return inmuebles
    .map((prop) => {
      const p = prop.PROPS;
      let score = 0;

      // Dormitorios
      if (req.dormitorios != null) {
        const d = Number(p.dormitorios);
        if (d >= req.dormitorios) score += 1;
        if (d === req.dormitorios) score += 1;
      } else score += 0.5;

      // Presupuesto
      if (req.presupuesto != null) {
        const precio = Number(p.precio);
        const lower = req.presupuesto * (1 - margin);
        const upper = req.presupuesto * (1 + margin);
        if (precio >= lower && precio <= upper) score += 2;
        else {
          const diff = Math.min(
            Math.abs(precio - lower),
            Math.abs(precio - upper)
          );
          score += Math.max(0, 2 - diff / req.presupuesto);
        }
      } else score += 0.5;

      // Tipo
      if (req.tipo != null) {
        if (p.tipo?.toLowerCase() === req.tipo.toLowerCase()) score += 1;
      } else score += 0.5;

      // Zona
      if (req.zona != null) {
        if (p.zona?.toLowerCase() === req.zona.toLowerCase()) score += 0.5;
      } else score += 0.25;

      return { ...prop, score };
    })
    .filter((prop) => prop.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Limitar a los 5 mejores
}




export const propFinderTool = tool(
    async ({ cantidad_de_habitaciones, presupuesto, tipo_de_propiedad, ubicacion }: z.infer<typeof propFinderSchema>, config) => {
        const state = await workflow.getState({
            configurable: { thread_id: config.configurable.thread_id },
        });
        const toolCallId = state.values.messages.at(-1).tool_calls.find((call:any) => call.name === "propFinder")?.id;

        console.log("config. ", config);
        console.log("state: ", state);

        

        // Validación de los parámetros

        const requisitos = {
            dormitorios: cantidad_de_habitaciones,
            presupuesto: presupuesto,
            tipo: tipo_de_propiedad,
            zona: ubicacion
        }

        // LLamada a la API para obtener las propiedades
        const data = await getProps();
        if(!data || data.length === 0) {
            return {toolMessage: new ToolMessage("No se pudieron obtener las propiedades desde la API.", toolCallId, "propFinder")}
        }

        // Filtrado y ordenamiento de las propiedades según los requisitos
        const dataFilter = filtrarYOrdenar(data, requisitos)
        console.log("dataFilter: ", dataFilter);
        if (dataFilter.length === 0) {
            return {toolMessage: new ToolMessage("No se encontraron propiedades que coincidan con los criterios proporcionados.", toolCallId, "propFinder")}
        }

        const message = `Según los requisitos se han encontrado las siguientes propiedades:
        ${JSON.stringify(dataFilter , null, 2)}


        Busqueda del ususario: 
        - Cantidad de habitaciones: ${cantidad_de_habitaciones}
        - Presupuesto: ${presupuesto}
        - Tipo de propiedad: ${tipo_de_propiedad}
        - Ubicación: ${ubicacion}
        - Tipo de operación: ${requisitos.tipo ? requisitos.tipo : "No especificado"}
        
        
        Accion a tomar: 

        En base a toda esta información debes decirle cual de las propiedades encontradas se ajustan mas a los requisitos de su busqueda, no le menciones las caracteristicas, ya que va a estar viendolas renderizadas en la pantalla con la información, en el mismo orden que vos la tenes aqui, por eso puedes decirle cosas como:
        - La propiedad 1... 
        - La propiedad 2...
        - La propiedad 3...

        y lo que quieras agrear , siempre mencionando el numero o la ubicación geografica de esa propiedad ya que va a ser el titulo de la descripción
        ;
        `

        
         return {toolMessage: new ToolMessage(message, toolCallId, "propFinder"), items: dataFilter}

  
    },{
    name: "propFinder",
    description: "Buscar propiedades según los criterios del usuario para la compra o alquiler",
    schema: propFinderSchema,
    }
)



